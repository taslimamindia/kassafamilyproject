import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Header from './components/header/Header'
import Footer from './components/footer/Footer'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Home from './components/pages/Home'
import Errors from './components/pages/Errors'
import ProtectedRoute from './ProtectedRoute'
import Login from './components/auth/Login'
import Logout from './components/auth/Logout'
import Profile from './components/profil/Profile'

function App() {
  return (
    <div className="d-flex flex-column vh-100">
      <ToastContainer position="top-center" autoClose={2000} newestOnTop closeOnClick theme="colored" />
      <Header />
      <main className="flex-grow-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route
            path="/profil"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route path="/errors" element={<Errors />} />
          <Route path="*" element={<Navigate to="/errors" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
