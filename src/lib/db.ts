// IndexedDB persistence — projects, media metadata, blobs, settings
import type { MediaAsset, Project } from './types'

const DB_NAME = 'star-edit-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IDB request failed'))
      })
  )
}

// ---- Projects ----
export async function allProjects(): Promise<Project[]> {
  const list = await tx<Project[]>('projects', 'readonly', (s) => s.getAll() as IDBRequest<Project[]>)
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}
export const getProject = (id: string) => tx<Project | undefined>('projects', 'readonly', (s) => s.get(id) as IDBRequest<Project | undefined>)
export const putProject = (p: Project) => tx('projects', 'readwrite', (s) => s.put(p))
export const deleteProject = (id: string) => tx('projects', 'readwrite', (s) => s.delete(id))

// ---- Media metadata ----
export async function mediaForProject(projectId: string): Promise<MediaAsset[]> {
  const list = await tx<MediaAsset[]>('media', 'readonly', (s) => s.getAll() as IDBRequest<MediaAsset[]>)
  return list.filter((m) => m.projectId === projectId).sort((a, b) => a.createdAt - b.createdAt)
}
export const putMedia = (m: MediaAsset) => tx('media', 'readwrite', (s) => s.put(m))
export const deleteMedia = (id: string) => {
  void tx('blobs', 'readwrite', (s) => s.delete(id))
  return tx('media', 'readwrite', (s) => s.delete(id))
}

// ---- Blobs ----
export const putBlob = (id: string, blob: Blob) => tx('blobs', 'readwrite', (s) => s.put(blob, id))
export const getBlob = (id: string) => tx<Blob | undefined>('blobs', 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)

// ---- KV settings ----
export const kvSet = (key: string, value: unknown) => tx('kv', 'readwrite', (s) => s.put(value, key))
export async function kvGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>('kv', 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>)
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  const e = await navigator.storage.estimate()
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 }
}
