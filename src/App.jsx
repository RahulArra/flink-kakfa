import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom"
import { Activity, BellRing } from "lucide-react"
import Analytics from "./pages/Analytics"
import Alerts from "./pages/Alert"
import "./index.css"

function Nav() {
  const location = useLocation();
  return (
    <nav className="navbar">
      <h2 style={{ margin: 0, marginRight: 'auto', color: 'var(--accent)' }}>DataPulse</h2>
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        <Activity size={20} /> Analytics
      </Link>
      <Link to="/alerts" className={`nav-link ${location.pathname === '/alerts' ? 'active' : ''}`}>
<BellRing size={20} /> Alerts
      </Link>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="dashboard-container">
        <Nav />
        <Routes>
          <Route path="/" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}