import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import AdminPanel from './AdminPanel'
import PublicProfile from './components/PublicProfile'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/admin" element={<AdminPanel />} />
                {/* Captura de slugs públicos */}
                <Route path="/:slug" element={<PublicProfile />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
