import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react'
import { signInAdmin, isSupabaseConfigured } from '../lib/supabase.ts'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('dedejuniarputra00@gmail.com')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await signInAdmin(email, password)

      if (error) {
        setErrorMessage(error.message)
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      navigate('/dashboard')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk.')
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#090D16] px-4 py-12 text-slate-100 overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Atmospheric background glow accents */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[380px] bg-gradient-to-b from-indigo-500/20 via-indigo-600/8 to-transparent blur-3xl rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-[400px] h-[250px] bg-blue-600/5 blur-3xl rounded-full" />

      {/* Grid Pattern Background Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 85% 65% at 50% 30%, black 40%, transparent 95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 85% 65% at 50% 30%, black 40%, transparent 95%)',
        }}
      />

      {/* Main Login Card */}
      <div className="relative w-full max-w-[420px] rounded-3xl border border-slate-800/80 bg-slate-900/40 p-8 sm:p-10 shadow-2xl shadow-black/60 backdrop-blur-2xl transition-all">
        {/* Logo / Brand Image Placeholder */}
        <div className="flex justify-center mb-6">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-14 w-auto max-w-[200px] object-contain"
            onError={(e) => {
              // Menampilkan visual placeholder jika file asset belum dimasukkan
              e.currentTarget.onerror = null
              e.currentTarget.src =
                'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="52" viewBox="0 0 180 52" fill="none"><rect width="180" height="52" rx="12" fill="%230b0f19" stroke="%23334155" stroke-dasharray="5 5"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="12" font-weight="500" font-family="sans-serif">Placeholder Logo</text></svg>'
            }}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-300/90 flex items-start gap-2">
              <span className="shrink-0 font-bold text-amber-400">INFO:</span>
              <span>
                Supabase belum terhubung di .env. Anda dapat mencoba login demo admin: <strong className="text-amber-200">admin@livein.com</strong> (password bebas min. 6 karakter).
              </span>
            </div>
          )}
          {/* Email input */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300"
            >
              Email
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dedejuniarputra00@gmail.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-indigo-500/80 focus:bg-slate-950/90 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-700"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300"
              >
                Kata Sandi
              </label>
              <a
                href="#forgot"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Lupa sandi?
              </a>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-3 pl-10 pr-11 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-indigo-500/80 focus:bg-slate-950/90 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center pt-0.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-700 bg-slate-950/80 text-indigo-600 focus:ring-indigo-500/30 cursor-pointer transition-colors"
              />
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                Ingat saya di perangkat ini
              </span>
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-indigo-400 hover:shadow-indigo-500/35 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badge at bottom of card */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 flex items-center justify-center gap-1.5 text-slate-500 text-[11px]">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-400/80" />
          <span>Koneksi aman dengan enkripsi SSL 256-bit</span>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} LIVEin. Hak cipta dilindungi.
      </div>
    </div>
  )
}
