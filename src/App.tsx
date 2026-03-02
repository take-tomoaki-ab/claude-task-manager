import { Routes, Route } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import ArchivePage from './pages/ArchivePage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/archive" element={<ArchivePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
