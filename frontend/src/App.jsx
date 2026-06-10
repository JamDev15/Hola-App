import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import NewOrder from './pages/NewOrder'
import CoPackers from './pages/CoPackers'
import Formulas from './pages/Formulas'
import Proofing from './pages/Proofing'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/co-packers" element={<CoPackers />} />
            <Route path="/formulas" element={<Formulas />} />
            <Route path="/proofing" element={<Proofing />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
