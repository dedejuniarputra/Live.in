import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Check,
  X,
} from 'lucide-react'
import { signInAdmin, onAdminAuthStateChanged } from '../lib/firebase.ts'
import liveLogo from '../assets/Live.jpg'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email wajib diisi.'
  if (email.trim().length > 254) return 'Email terlalu panjang.'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email.trim())) return 'Format email tidak valid.'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return 'Kata sandi wajib diisi.'
  if (password.length < 6) return 'Kata sandi minimal 6 karakter.'
  if (password.length > 128) return 'Kata sandi terlalu panjang.'
  return null
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const location = useLocation()
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [logoutSuccessToast, setLogoutSuccessToast] = useState(false)

  useEffect(() => {
    document.title = 'Live.IN | Login'
    localStorage.removeItem('livein_demo_admin_session')

    // Jika sudah memiliki sesi autentikasi Firebase yang sah, langsung ke Dashboard
    const unsubscribe = onAdminAuthStateChanged((user) => {
      if (user) {
        navigate('/dashboard', { replace: true })
      }
    })

    const hasSessionFlag = sessionStorage.getItem('logout_success_toast') === '1'
    const hasStateFlag = Boolean((location.state as any)?.logoutSuccess)

    if (hasSessionFlag || hasStateFlag) {
      sessionStorage.removeItem('logout_success_toast')
      if (hasStateFlag) {
        navigate(location.pathname, { replace: true, state: {} })
      }
      setLogoutSuccessToast(true)
      const timer = setTimeout(() => {
        setLogoutSuccessToast(false)
      }, 4000)
      return () => {
        clearTimeout(timer)
        unsubscribe()
      }
    }

    return () => unsubscribe()
  }, [location.state, location.pathname, navigate])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)
    setFieldErrors({})

    // Rate limit: lockout setelah MAX_ATTEMPTS gagal
    const now = Date.now()
    if (lockedUntil > now) {
      const secsLeft = Math.ceil((lockedUntil - now) / 1000)
      setErrorMessage(`Terlalu banyak percobaan. Coba lagi dalam ${secsLeft} detik.`)
      return
    }

    // Validasi client-side
    const emailErr = validateEmail(email)
    const passErr = validatePassword(password)
    if (emailErr || passErr) {
      setFieldErrors({ email: emailErr ?? undefined, password: passErr ?? undefined })
      return
    }

    setIsLoading(true)

    try {
      const { error } = await signInAdmin(email, password)

      if (error) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS)
          setAttempts(0)
          setErrorMessage(`Terlalu banyak percobaan gagal. Akun dikunci selama ${LOCKOUT_MS / 1000} detik.`)
        } else {
          setErrorMessage(error.message)
        }
        setIsLoading(false)
        return
      }

      setAttempts(0)
      setIsLoading(false)
      sessionStorage.setItem('login_success_toast', '1')
      navigate('/dashboard', { state: { loginSuccess: true } })
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk.')
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] px-4 py-12 text-stone-100 overflow-hidden selection:bg-[#C9A26A]/30 selection:text-[#C9A26A]">
      {/* Notifikasi Berhasil Logout (Sisi Kanan Atas - Style Default Tailwind) */}
      {logoutSuccessToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 w-full max-w-sm p-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="inline-flex items-center justify-center shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-900/40 dark:text-green-300">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">Berhasil Keluar</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Anda telah berhasil logout dari akun admin.</p>
          </div>
          <button
            type="button"
            onClick={() => setLogoutSuccessToast(false)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Atmospheric background glow accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-to-b from-[#C9A26A]/15 via-[#C9A26A]/5 to-transparent blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-[400px] h-[250px] bg-[#C9A26A]/5 blur-3xl rounded-full" />

      {/* Grid Pattern Background Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(201, 162, 106, 0.035) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(201, 162, 106, 0.035) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 85% 65% at 50% 30%, black 40%, transparent 95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 65% at 50% 30%, black 40%, transparent 95%)',
        }}
      />

      {/* Main Login Card */}
      <div className="relative w-full max-w-[420px] rounded-3xl border border-stone-800 bg-[#141312] p-8 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-2xl transition-all">
        {/* Branding Livesostory Admin Studio with Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg shadow-black/70 border border-stone-800 p-0.5 bg-black flex items-center justify-center mb-3 hover:border-[#C9A26A]/40 transition-colors">
            <img
              src={liveLogo}
              alt="Logo LiveSOStory"
              className="h-full w-full object-contain rounded-xl"
            />
          </div>
          <h1 className="font-extrabold text-xl tracking-wider text-white">
            LIVESOSTORY.CO
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}


          {/* Email input */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-stone-300"
            >
              Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })) }}
                placeholder="nama@email.com"
                className={`w-full rounded-xl border ${fieldErrors.email ? 'border-rose-500/60' : 'border-stone-800'} bg-[#0e0d0c] py-3 pl-10 pr-4 text-sm text-stone-100 placeholder-stone-600 transition-all focus:border-[#C9A26A] focus:bg-[#0e0d0c] focus:outline-none focus:ring-4 focus:ring-[#C9A26A]/15 hover:border-stone-700 [&:-webkit-autofill]:bg-[#0e0d0c] [&:-webkit-autofill]:[-webkit-text-fill-color:#f5f5f4] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0e0d0c_inset]`}
              />
            </div>
            {fieldErrors.email && (
              <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-stone-300"
            >
              Kata Sandi
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })) }}
                placeholder="••••••••"
                className={`w-full rounded-xl border ${fieldErrors.password ? 'border-rose-500/60' : 'border-stone-800'} bg-[#0e0d0c] py-3 pl-10 pr-11 text-sm text-stone-100 placeholder-stone-600 transition-all focus:border-[#C9A26A] focus:bg-[#0e0d0c] focus:outline-none focus:ring-4 focus:ring-[#C9A26A]/15 hover:border-stone-700 [&:-webkit-autofill]:bg-[#0e0d0c] [&:-webkit-autofill]:[-webkit-text-fill-color:#f5f5f4] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#0e0d0c_inset]`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.password}</p>
            )}
          </div>


          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#C9A26A] hover:bg-[#ba965c] py-3 px-4 text-sm font-bold text-stone-950 shadow-lg shadow-[#C9A26A]/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-stone-950/30 border-t-stone-950" />
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-xs text-stone-600">
        &copy; {new Date().getFullYear()} Live.IN. Hak cipta dilindungi.
      </div>
    </div>
  )
}

