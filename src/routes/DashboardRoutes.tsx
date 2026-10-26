import { useEffect, useState, type ReactNode } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from 'react-router-dom'
import Login from '../auth/Login.tsx'
import Dashboard from '../components/admin/dashboard.tsx'
import PhotoSelection from '../components/client/PhotoSelection.tsx'
import AlbumShare from '../components/client/AlbumShare.tsx'
import { onAdminAuthStateChanged } from '../lib/firebase.ts'

function ProtectedAdminRoute({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = onAdminAuthStateChanged((user) => {
      setIsAuthenticated(Boolean(user))
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A26A] border-t-transparent" />
          <p className="text-xs text-stone-400">Memverifikasi sesi Admin...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

function ClientSlugDispatcher() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const raw = slug || location.pathname.split('/').filter(Boolean).pop() || ''
  if (raw && (raw.endsWith('-3') || raw.includes('album'))) {
    return <AlbumShare />
  }
  return <PhotoSelection />
}

export default function DashboardRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Halaman Login Admin */}
        <Route path="/login" element={<Login />} />

        {/* Halaman Dashboard Khusus Admin (Hanya ini yang terproteksi login) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedAdminRoute>
              <Dashboard />
            </ProtectedAdminRoute>
          }
        />
        <Route path="/admin" element={<Navigate to="/dashboard" replace />} />

        {/* ============================================================== */}
        {/* HALAMAN PUBLIK KLIEN - SAMA SEKALI TIDAK PERLU LOGIN           */}
        {/* ============================================================== */}
        {/* 1. Halaman Seleksi Foto Klien Sesuai Screenshot & Variasi URL */}
        <Route path="/livesotory-co/:slug" element={<PhotoSelection />} />
        <Route path="/livesostory-co/:slug" element={<PhotoSelection />} />
        <Route path="/livesotory.co/:slug" element={<PhotoSelection />} />
        <Route path="/livesostory.co/:slug" element={<PhotoSelection />} />
        <Route path="/livesotory/:slug" element={<PhotoSelection />} />
        <Route path="/livesostory/:slug" element={<PhotoSelection />} />
        <Route path="/gallery/:slug" element={<PhotoSelection />} />
        <Route path="/select/:slug" element={<PhotoSelection />} />
        <Route path="/pilihin/:slug" element={<PhotoSelection />} />

        {/* Wildcard fallbacks for client link variations */}
        <Route path="/livesotory-co/*" element={<PhotoSelection />} />
        <Route path="/livesostory-co/*" element={<PhotoSelection />} />
        <Route path="/livesotory.co/*" element={<PhotoSelection />} />
        <Route path="/livesostory.co/*" element={<PhotoSelection />} />

        {/* 2. Halaman Album Kenangan / Memories Klien */}
        <Route path="/album/:slug" element={<AlbumShare />} />
        <Route path="/album-share/:slug" element={<AlbumShare />} />
        <Route path="/album/*" element={<AlbumShare />} />
        <Route path="/album-share/*" element={<AlbumShare />} />

        {/* Format slug langsung (contoh: /wisuda-putra-22-agustus-2026-3 atau /dede) */}
        <Route path="/:slug" element={<ClientSlugDispatcher />} />

        {/* Default route */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
