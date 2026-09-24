// Robust image decoding pipeline — handles iPhone HEIC/HEIF, exotic formats, decode failures.
// Strategy: sniff real format from magic bytes → try native decode (Safari decodes HEIC
// natively) → try createImageBitmap → fall back to in-browser HEIC→JPEG conversion
// (heic2any via CDN, loaded lazily) → honest failure flag, never a silent dead image.

export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'avif' | 'heic' | 'tiff' | 'other'

/** Read the first bytes of a file and identify the *real* container (extension lies). */
export async function sniffImageKind(blob: Blob): Promise<ImageKind> {
  try {
    const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
    if (head.length < 12) return 'other'
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg'
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png'
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return 'gif'
    if (head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return 'webp'
    if (head[0] === 0x42 && head[1] === 0x4d) return 'bmp'
    if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      // ISO-BMFF container — read the major brand to tell HEIC / AVIF / other
      const brand = String.fromCharCode(head[8], head[9], head[10], head[11])
      if (/^(heic|heix|hevc|hevx|heim|heis|heif|mif1|msf1|avif)$/i.test(brand)) {
        return brand.toLowerCase() === 'avif' ? 'avif' : 'heic'
      }
      return 'other'
    }
    if ((head[0] === 0x49 && head[1] === 0x49) || (head[0] === 0x4d && head[1] === 0x4d)) return 'tiff'
    return 'other'
  } catch {
    return 'other'
  }
}

export interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  /** HTMLImageElement when available (best for repeated drawImage) */
  el?: HTMLImageElement
  bitmap?: ImageBitmap
}

async function decodeViaImgElement(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.decoding = 'sync'
    img.src = url
    try {
      await img.decode()
    } catch {
      // decode() can reject on some valid images (SVG without dims, huge files) — wait for load
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('img load failed'))
        setTimeout(() => rej(new Error('img load timeout')), 12000)
      })
    }
    const w = img.naturalWidth || (img as HTMLImageElement & { width: number }).width
    const h = img.naturalHeight || (img as HTMLImageElement & { height: number }).height
    if (!w || !h) throw new Error('image has no dimensions')
    // keep element alive — revoke only after decode; the element already holds decoded data
    return { source: img, width: w, height: h, el: img }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }
}

async function decodeViaBitmap(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap unavailable')
  const bmp = await createImageBitmap(blob)
  if (!bmp.width || !bmp.height) throw new Error('bitmap has no dimensions')
  return { source: bmp, width: bmp.width, height: bmp.height, bitmap: bmp }
}

/** Native + bitmap decode attempts. Throws if the browser truly cannot display this blob. */
export async function decodeImageAny(blob: Blob): Promise<DecodedImage> {
  try {
    return await decodeViaImgElement(blob)
  } catch {
    return await decodeViaBitmap(blob)
  }
}

// ---------- HEIC conversion (browsers other than Safari cannot display HEIC) ----------
// libheif-js (WASM, inlined bundle) decodes Apple HEIC/HEIF fully in-browser.
// heic2any@0.0.4 is broken in current Chrome (FileReader type error in its worker).

let heifLoader: Promise<((ab: ArrayBuffer) => Promise<Blob>) | null> | null = null

interface LibheifImage {
  get_width(): number
  get_height(): number
  is_primary?(): boolean
  display(
    opts: { data: Uint8ClampedArray; width: number; height: number },
    cb: (d: { width: number; height: number; data: Uint8ClampedArray }) => void
  ): void
}

interface LibheifModule {
  HeifDecoder: new () => { decode(buf: ArrayBuffer): LibheifImage[] }
}

function loadLibheif(): Promise<((ab: ArrayBuffer) => Promise<Blob>) | null> {
  if (heifLoader) return heifLoader
  heifLoader = new Promise((resolve) => {
    const w = window as unknown as { libheif?: () => unknown }
    let settled = false
    const settle = (v: ((ab: ArrayBuffer) => Promise<Blob>) | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    // Emscripten factories return a thenable module — the WASM runtime may still be
    // initializing, so it MUST be awaited before using HeifDecoder.
    const build = async () => {
      try {
        const mod = (await Promise.resolve(w.libheif!())) as LibheifModule
        if (!mod || typeof mod.HeifDecoder !== 'function') return settle(null)
        const decodeToJpeg = async (ab: ArrayBuffer): Promise<Blob> => {
          const decoder = new mod.HeifDecoder()
          const data = decoder.decode(ab)
          if (!data || !data.length) throw new Error('no HEIF image found')
          // Apple photos may embed depth maps — prefer the primary (main) image.
          // is_primary() can throw a ReferenceError on builds that don't export
          // heif_image_handle_is_primary_image — fall back to the first image.
          let image = data[0]
          try {
            image = data.find((im) => {
              try {
                return typeof im.is_primary === 'function' && im.is_primary()
              } catch {
                return false
              }
            }) ?? data[0]
          } catch { /* keep first image */ }
          const w0 = image.get_width()
          const h0 = image.get_height()
          if (!w0 || !h0) throw new Error('HEIF image has no dimensions')
          const out = await new Promise<{ width: number; height: number; data: Uint8ClampedArray }>((res, rej) => {
            image.display({ data: new Uint8ClampedArray(w0 * h0 * 4), width: w0, height: h0 }, (d) => res(d))
            setTimeout(() => rej(new Error('HEIF decode timeout')), 20000)
          })
          const c = document.createElement('canvas')
          c.width = out.width
          c.height = out.height
          const ctx = c.getContext('2d')!
          ctx.putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0)
          const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92))
          if (!blob || blob.size === 0) throw new Error('JPEG encode failed')
          return blob
        }
        settle(decodeToJpeg)
      } catch (err) {
        console.error('[star-edit] libheif init failed:', err)
        settle(null)
      }
    }
    if (typeof w.libheif === 'function') return void build()
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/libheif-js@1.18.2/libheif-wasm/libheif-bundle.js'
    s.async = true
    s.onload = () => void (typeof w.libheif === 'function' ? build() : settle(null))
    s.onerror = () => settle(null)
    // safety net: if onload never fires but the bundle registered late, still settle
    setTimeout(() => {
      if (typeof w.libheif === 'function') void build()
      else settle(null)
    }, 30000)
    document.head.appendChild(s)
  })
  return heifLoader
}

/** Convert HEIC/HEIF → JPEG. Returns null when conversion is impossible (offline / no lib). */
export async function convertHeicToJpeg(blob: Blob, _quality = 0.92): Promise<Blob | null> {
  const fn = await loadLibheif()
  if (!fn) return null
  try {
    return await fn(await blob.arrayBuffer())
  } catch (err) {
    console.error('[star-edit] HEIC conversion failed:', err)
    return null
  }
}

export interface PreparedImage {
  /** Decodable blob (HEIC gets converted to JPEG; otherwise the original). */
  blob: Blob
  decoded: DecodedImage
  kind: ImageKind
  /** true when the original HEIC was converted to JPEG for browser display */
  converted: boolean
}

/**
 * Full pipeline for an uploaded image file:
 * 1. sniff real format  2. try native decode  3. HEIC → try conversion  4. re-decode.
 * Throws only when nothing can display the file — callers show an honest message.
 */
export async function prepareImageFile(file: Blob): Promise<PreparedImage> {
  const kind = await sniffImageKind(file)
  // Fast path: browsers natively decode these
  if (kind !== 'heic') {
    const decoded = await decodeImageAny(file)
    return { blob: file, decoded, kind, converted: false }
  }
  // Safari & iOS decode HEIC natively — try first, keep original bytes
  try {
    const decoded = await decodeImageAny(file)
    return { blob: file, decoded, kind, converted: false }
  } catch {
    /* needs conversion */
  }
  const jpeg = await convertHeicToJpeg(file)
  if (jpeg) {
    const decoded = await decodeImageAny(jpeg)
    return { blob: jpeg, decoded, kind: 'jpeg', converted: true }
  }
  throw new Error('HEIC conversion unavailable')
}
