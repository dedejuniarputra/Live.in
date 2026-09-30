import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LIVEin ErrorBoundary] Caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#090D16] text-white p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-[#C9A26A] mb-4">
              <svg
                className="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold tracking-tight">Terjadi Kendala Memuat Tampilan</h2>
            <p className="text-xs text-slate-400 mt-2 mb-6 leading-relaxed">
              Sistem mendeteksi adanya kendala saat merender halaman. Silakan muat ulang halaman atau kembali ke galeri utama.
            </p>
            {this.state.error?.message && (
              <div className="text-[11px] text-rose-300/90 bg-rose-950/40 p-3 rounded-xl border border-rose-900/40 font-mono mb-6 text-left break-all">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] py-3 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 cursor-pointer"
              >
                Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/livesotory-co/wisuda-putra-22-agustus-2026'
                }}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Buka Galeri Foto Utama
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/dashboard'
                }}
                className="w-full rounded-xl border border-slate-800 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Kembali ke Dashboard Admin
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
