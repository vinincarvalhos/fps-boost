import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Route, Routes } from 'react-router-dom'
import './styles/app.css'
import { Shell } from './components/Shell'
import { Dashboard } from './pages/Dashboard'
import { Tweaks } from './pages/Tweaks'
import { Backup } from './pages/Backup'
import { Settings } from './pages/Settings'
import { License } from './pages/License'
import { ComingSoon } from './pages/ComingSoon'
import { NAV } from './lib/nav'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="tweaks" element={<Tweaks />} />
          <Route path="backup" element={<Backup />} />
          <Route path="settings" element={<Settings />} />
          <Route path="license" element={<License />} />
          {NAV.filter((n) => n.phase > 1).map((n) => (
            <Route key={n.path} path={n.path.slice(1)} element={<ComingSoon item={n} />} />
          ))}
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>
)
