import { useEffect, useState } from 'react'
import { I18nProvider } from './lib/i18n'
import { MotionConfig } from 'framer-motion'
import Landing from './pages/Landing'
import Projects from './pages/Projects'
import EditorPage from './pages/EditorPage'
import Guide from './pages/Guide'

type Route = { name: 'landing' } | { name: 'projects' } | { name: 'editor'; id: string } | { name: 'guide' }

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (raw.startsWith('editor/')) return { name: 'editor', id: raw.slice(7) }
  if (raw === 'projects') return { name: 'projects' }
  if (raw === 'guide') return { name: 'guide' }
  return { name: 'landing' }
}

function Router() {
  const [route, setRoute] = useState<Route>(parseHash)
  useEffect(() => {
    const fn = () => {
      setRoute(parseHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  if (route.name === 'editor') return <EditorPage projectId={route.id} />
  if (route.name === 'projects') return <Projects />
  if (route.name === 'guide') return <Guide />
  return <Landing />
}

export default function App() {
  return (
    <I18nProvider>
      <MotionConfig reducedMotion="user">
        <Router />
      </MotionConfig>
    </I18nProvider>
  )
}

export function navigate(to: string) {
  window.location.hash = to
}
