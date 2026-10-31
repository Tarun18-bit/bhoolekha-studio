import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LoginScreen } from './components/LoginScreen'
import { CitizenPortal } from './components/CitizenPortal'
import { installAuthFetch, restoreSession, setToken, type SessionUser } from './auth'

installAuthFetch()

function Root() {
  if (window.location.pathname.startsWith('/citizen')) return <CitizenPortal />
  return <OfficerApp />
}

function OfficerApp() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [notice, setNotice] = useState<string | undefined>()

  useEffect(() => {
    restoreSession().then((u) => { setUser(u); setChecking(false) })
    const onExpired = () => { setUser(null); setNotice('Your session expired. Please sign in again.') }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  if (checking) return null
  if (!user) return <LoginScreen notice={notice} onLogin={(u) => { setNotice(undefined); setUser(u) }} />
  return <App user={user} onLogout={() => { setToken(null); setUser(null) }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
