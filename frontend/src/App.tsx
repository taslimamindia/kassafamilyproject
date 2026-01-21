import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Header from './components/header/Header'
import Footer from './components/footer/Footer'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Home from './components/pages/Home'
import Errors from './components/pages/Errors'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'
import AdminGroupRoute from './AdminGroupRoute'
import HomeAdmin from './components/admin/HomeAdmin'
import HomeAdminGroup from './components/admingroup/HomeAdminGroup'
import Login from './components/auth/Login'
import ChangePasswordFirstLogin from './components/auth/ChangePasswordFirstLogin'
import Logout from './components/auth/Logout'
import Profile from './components/profil/Profile'
import CreateAdmin from './components/pages/CreateAdmin'
import './i18n'
import { LanguageProvider } from './contexts/LanguageContext'
import HomeUser from './components/user/HomeUser'
import Tree from './components/familytree/Tree'
import HomeChartes from './components/chartes/HomeChartes'
import FloatingChatButton from './components/notifications/FloatingChatButton'
import Transactions from './components/transactions/Transactions'
import HomeCaisse from './components/transactions/HomeCaisse'
import TransactionApprovals from './components/transactions/TransactionApprovals'
import NotificationsPage from './components/notifications/NotificationsPage'

function App() {
  return (
    <LanguageProvider>
      <div className="d-flex flex-column" style={{ minHeight: '100dvh' }}>
        <ToastContainer position="top-center" autoClose={2000} newestOnTop closeOnClick theme="colored" />
        <Header />
        <main className="flex-grow-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/chartes" element={<HomeChartes />} />
            <Route
              path="/tree"
              element={
                <ProtectedRoute>
                  <Tree />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<Login />} />
            <Route path="/change-password" element={<ChangePasswordFirstLogin />} />
            <Route path="/logout" element={<Logout />} />
            <Route
              path="/profil"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            <Route
              path="/create-admin"
              element={
                <ProtectedRoute>
                  <CreateAdmin />
                </ProtectedRoute>
              }
            />

            <Route
              path="/errors"
              element={<Errors />}
            />
            
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <HomeAdmin />
                </AdminRoute>
              }
            />
            <Route
              path="/admingroup"
              element={
                <AdminGroupRoute>
                  <HomeAdminGroup />
                </AdminGroupRoute>
              }
            />
            <Route
              path="/user"
              element={
                <ProtectedRoute>
                  <HomeUser />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caisse"
              element={
                <ProtectedRoute>
                  <HomeCaisse />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute>
                  <TransactionApprovals />
                </ProtectedRoute>
              }
            />

            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Add/Update handled via modals inside the Transactions page; routes removed */}
            <Route path="*" element={<Navigate to="/errors" replace />} />
          </Routes>
        </main>
        <Footer />
        <FloatingChatButton />
      </div>
    </LanguageProvider>
  )
}

export default App
