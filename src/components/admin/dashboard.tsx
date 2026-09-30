import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  User,
  ChevronDown,
  Link2,
  Check,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Copy,
  CloudDownload,
  Pencil,
  Settings,
  Clock,
  Trash2,
  Eye,
  Sun,
  Moon,
  Sparkles,
  AlertCircle,
  Image as ImageIcon,
  FolderCheck,
  X,
} from 'lucide-react'
import { signOutAdmin, supabase, ADMIN_EMAIL } from '../../lib/supabase.ts'
import {
  getStoredGalleries,
  saveOrUpdateGallery,
  deleteGallery,
  type GalleryData,
} from '../../lib/galleryStore.ts'
import {
  scanGoogleDriveFolder,
  extractDriveFolderId,
  type DrivePhotoItem,
} from '../../lib/googleDrive.ts'

export default function Dashboard() {
  const navigate = useNavigate()
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false)
  const adminMenuRef = useRef<HTMLDivElement>(null)

  const [adminEmail, setAdminEmail] = useState<string>(ADMIN_EMAIL)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setAdminEmail(user.email)
      }
    })
  }, [])

  // Theme state: Default dark mode mengikuti tampilan login
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('livein-theme')
    return saved !== null ? saved === 'dark' : true
  })

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev
      localStorage.setItem('livein-theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Galleries list state (synced with storage & client routes)
  const [galleries, setGalleries] = useState<GalleryData[]>(() =>
    getStoredGalleries()
  )

  // Share Ready Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareModalData, setShareModalData] = useState<{
    clientName: string
    whatsapp: string
    safeSlug: string
    selectionLink: string
    albumLink: string
    fullMessage: string
  } | null>(null)

  const openShareModalForGallery = (gallery: GalleryData) => {
    const rawName = (gallery.clientName || 'klien').trim()
    const safeSlug =
      (gallery.slug || rawName)
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'klien'
    const baseUrl = window.location.origin
    const selectionLink = `${baseUrl}/livesotory-co/${safeSlug}`
    const albumLink = `${baseUrl}/${safeSlug}-3?t=${gallery.shareToken || 'vtmsvc3urqfm'}`

    const fullMessage = `Halo ${gallery.clientName.toUpperCase()}
Galeri foto kamu dari Livesostory.co sudah siap di Pilihin.

Pilih foto favorit kamu :
${selectionLink}

Bagikan album ini ke teman dan keluarga kamu :
${albumLink}
(bisa atur siapa yang lihat, ganti sampul, bikin pin)

Selamat menikmati momennya`

    setShareModalData({
      clientName: gallery.clientName,
      whatsapp: gallery.whatsapp,
      safeSlug,
      selectionLink,
      albumLink,
      fullMessage,
    })
    setIsShareModalOpen(true)
  }

  // Form states
  const [driveLink, setDriveLink] = useState('')
  const [maxPhotos, setMaxPhotos] = useState('60')
  const [selectionDeadline, setSelectionDeadline] = useState('30 hari')
  const [clientName, setClientName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [highlightDescription, setHighlightDescription] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientWhatsapp, setClientWhatsapp] = useState('')
  const [allowDownload, setAllowDownload] = useState(true)

  // Scanned photos preview state (Real-time scan hasil foto Drive)
  const [scannedPhotos, setScannedPhotos] = useState<DrivePhotoItem[]>([])
  const [isScanningLink, setIsScanningLink] = useState(false)
  const [scanResultSource, setScanResultSource] = useState<string>('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [detectedFolderName, setDetectedFolderName] = useState<string>('')
  const [previewLightboxPhoto, setPreviewLightboxPhoto] = useState<DrivePhotoItem | null>(null)
  const [showAllScannedModal, setShowAllScannedModal] = useState(false)
  const [galleryToDelete, setGalleryToDelete] = useState<GalleryData | null>(null)

  const confirmDeleteGallery = (gallery: GalleryData) => {
    const updated = deleteGallery(gallery.id, gallery.slug)
    setGalleries([...updated])
    setGalleryToDelete(null)
    showToast(`Galeri "${gallery.clientName}" berhasil dihapus.`)
  }

  // Scanning modal state (saat submit)
  const [isScanningModalOpen, setIsScanningModalOpen] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatusText, setScanStatusText] = useState('Membaca folder Drive...')

  // Status & feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        adminMenuRef.current &&
        !adminMenuRef.current.contains(event.target as Node)
      ) {
        setIsAdminMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await signOutAdmin()
    navigate('/login')
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  const handleWhatsappChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Hanya angka, otomatis menghapus spasi dan tanda hubung
    const sanitized = e.target.value.replace(/\D/g, '')
    setClientWhatsapp(sanitized)
  }

  // Fungsi memindai link Google Drive dan menampilkan preview foto
  const handleScanLink = async (urlToScan = driveLink) => {
    const trimmed = urlToScan.trim()
    if (!trimmed) return

    const folderId = extractDriveFolderId(trimmed)
    if (!folderId) {
      setScanError('Link folder Google Drive tidak valid atau ID folder tidak ditemukan.')
      return
    }

    setIsScanningLink(true)
    setScanError(null)

    try {
      const result = await scanGoogleDriveFolder(trimmed, clientName)
      setIsScanningLink(false)

      if (result.success && result.photos && result.photos.length > 0) {
        setScannedPhotos(result.photos)
        setScanResultSource(result.source || 'drive-api')
        if (result.folderName) {
          setDetectedFolderName(result.folderName)
          // Jika nama klien masih kosong, otomatis isi dengan nama folder Drive
          if (!clientName.trim()) {
            setClientName(result.folderName)
          }
        }
        showToast(`Berhasil memindai ${result.photos.length} foto dari Google Drive!`)
      } else {
        setScannedPhotos([])
        setScanError(
          result.error ||
            'Folder Google Drive kosong atau tidak dapat diakses. Pastikan hak akses diset "Siapa saja yang memiliki link" -> "Pelihat".'
        )
      }
    } catch (err: any) {
      setIsScanningLink(false)
      setScannedPhotos([])
      setScanError(err?.message || 'Gagal memindai folder Google Drive.')
    }
  }

  // Otomatis scan saat user selesai mengetik / menempelkan link Google Drive
  useEffect(() => {
    const trimmed = driveLink.trim()
    if (!trimmed) {
      setScannedPhotos([])
      setScanError(null)
      setDetectedFolderName('')
      return
    }

    const folderId = extractDriveFolderId(trimmed)
    if (!folderId) return

    const debounceTimer = setTimeout(() => {
      handleScanLink(trimmed)
    }, 750)

    return () => clearTimeout(debounceTimer)
  }, [driveLink])

  const isFormValid =
    driveLink.trim().length > 0 && clientWhatsapp.trim().length > 0

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    // Mulai proses pemindaian folder drive
    setIsScanningModalOpen(true)
    setScanProgress(15)
    setScanStatusText('Membaca folder Drive...')

    setTimeout(() => {
      setScanProgress(45)
      setScanStatusText('Membaca struktur folder & file foto dari Drive API...')
    }, 800)

    setTimeout(() => {
      setScanProgress(75)
      setScanStatusText('Mengalirkan direct stream link Google Drive CDN...')
    }, 1800)

    // Ambil foto langsung dari Google Drive via scanGoogleDriveFolder (atau gunakan yang sudah terscan)
    const driveResult =
      scannedPhotos.length > 0
        ? {
            success: true,
            folderId: extractDriveFolderId(driveLink) || '',
            folderName: detectedFolderName || clientName,
            photos: scannedPhotos,
            source: scanResultSource || 'drive-api',
          }
        : await scanGoogleDriveFolder(driveLink, clientName)

    if (!driveResult.success || driveResult.photos.length === 0) {
      setTimeout(() => {
        setIsScanningModalOpen(false)
        showToast(
          driveResult.error ||
            'Folder Google Drive kosong atau terkunci. Pastikan akses folder diset: "Siapa saja yang memiliki link" (Pelihat).'
        )
      }, 1500)
      return
    }

    setTimeout(() => {
      setScanProgress(100)
      setScanStatusText(
        `Berhasil memindai ${driveResult.photos.length} foto dari Google Drive!`
      )
    }, 2000)

    setTimeout(() => {
      setIsScanningModalOpen(false)

      const finalClientName = clientName.trim() || detectedFolderName.trim() || 'Klien Baru'
      const safeSlug = finalClientName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'klien'
      const days = parseInt(selectionDeadline) || 30

      const newGalleryItem: GalleryData = {
        id: `gal-${Date.now()}`,
        clientName: finalClientName,
        date: eventDate || new Date().toISOString().split('T')[0],
        maxPhotos: parseInt(maxPhotos) || 60,
        selectedPhotos: 0,
        remainingDays: days,
        status: 'Belum mulai',
        isClientViewed: false,
        whatsapp: clientWhatsapp,
        driveLink: driveLink,
        slug: safeSlug,
        shareToken: 'vtmsvc3urqfm',
        coverUrl: driveResult.photos[0]?.url,
        highlightDescription: highlightDescription,
        selectedPhotoIds: [],
        photos: driveResult.photos,
      }

      saveOrUpdateGallery(newGalleryItem)
      setGalleries(getStoredGalleries())

      // Buka modal "Galeri siap dikirim 🎉"
      openShareModalForGallery(newGalleryItem)
      showToast(
        `Berhasil memindai ${driveResult.photos.length} foto langsung dari Google Drive!`
      )

      // Reset form
      setDriveLink('')
      setScannedPhotos([])
      setDetectedFolderName('')
      setScanError(null)
      setClientName('')
      setEventDate('')
      setHighlightDescription('')
      setClientEmail('')
      setClientWhatsapp('')
      setMaxPhotos('60')
      setSelectionDeadline('30 hari')
      setAllowDownload(true)
      setScanProgress(0)
    }, 3200)
  }

  return (
    <div
      className={`relative min-h-screen font-sans transition-colors duration-200 pb-20 ${
        isDarkMode
          ? 'bg-[#090D16] text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200'
          : 'bg-[#FBF9F5] text-stone-900 selection:bg-[#9C7844] selection:text-white'
      }`}
    >
      {/* Atmospheric Radial Glow Gradients */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {isDarkMode ? (
          <>
            <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-gradient-to-b from-indigo-500/20 via-indigo-600/8 to-transparent blur-3xl rounded-full" />
            <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] bg-emerald-500/5 blur-3xl rounded-full" />
            <div className="absolute top-2/3 right-1/4 w-[450px] h-[300px] bg-blue-600/5 blur-3xl rounded-full" />
          </>
        ) : (
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#9C7844]/10 via-[#9C7844]/3 to-transparent blur-3xl rounded-full" />
        )}
      </div>

      {/* Grid Pattern Background Overlay with Radial Mask */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          backgroundImage: isDarkMode
            ? `linear-gradient(to right, rgba(255, 255, 255, 0.045) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(255, 255, 255, 0.045) 1px, transparent 1px)`
            : `linear-gradient(to right, rgba(0, 0, 0, 0.035) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(0, 0, 0, 0.035) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage:
            'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 95%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 15%, black 40%, transparent 95%)',
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-stone-900/20 border border-stone-800 transition-all animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md transition-colors duration-200 ${
          isDarkMode
            ? 'border-slate-800/80 bg-[#090D16]/85 text-slate-100'
            : 'border-stone-200/80 bg-white/90 text-stone-900'
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3.5">
          {/* Logo Brand Placeholder */}
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-9 w-auto max-w-[160px] object-contain"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src = isDarkMode
                  ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="38" viewBox="0 0 130 38" fill="none"><rect width="130" height="38" rx="8" fill="%230f172a" stroke="%23334155" stroke-dasharray="4 4"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="11" font-weight="500" font-family="sans-serif">Placeholder Logo</text></svg>'
                  : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="130" height="38" viewBox="0 0 130 38" fill="none"><rect width="130" height="38" rx="8" fill="%23f5f5f4" stroke="%23d6d3d1" stroke-dasharray="4 4"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2378716c" font-size="11" font-weight="500" font-family="sans-serif">Placeholder Logo</text></svg>'
              }}
            />
          </div>

          {/* Right Actions: Dark/Light Mode Button & Admin Dropdown */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isDarkMode
                  ? 'border-slate-800 bg-slate-900/80 text-amber-400 hover:border-slate-700 hover:bg-slate-800'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 shadow-2xs'
              }`}
              title={
                isDarkMode
                  ? 'Beralih ke mode terang (Light)'
                  : 'Beralih ke mode gelap (Dark)'
              }
              aria-label="Ubah tema"
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Admin Menu Dropdown */}
            <div className="relative" ref={adminMenuRef}>
              <button
                type="button"
                onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-2xs transition-all cursor-pointer select-none ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900/80 text-slate-200 hover:border-slate-700 hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <User className="h-3.5 w-3.5 text-stone-400" />
                <span>Admin</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isAdminMenuOpen ? 'rotate-180' : ''
                  } ${isDarkMode ? 'text-slate-500' : 'text-stone-400'}`}
                />
              </button>

              {isAdminMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-900 text-slate-100 shadow-black/50'
                      : 'border-stone-200 bg-white text-stone-900 shadow-stone-900/10'
                  }`}
                >
                  <div
                    className={`px-3 py-2 border-b ${
                      isDarkMode ? 'border-slate-800' : 'border-stone-100'
                    }`}
                  >
                    <p className="text-xs font-semibold">Administrator</p>
                    <p
                      className={`text-[10px] ${
                        isDarkMode ? 'text-slate-400' : 'text-stone-400'
                      }`}
                    >
                      {adminEmail}
                    </p>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Form Section */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 pt-8">
        <div
          className={`rounded-2xl border transition-all overflow-hidden ${
            isDarkMode
              ? 'border-slate-800/80 bg-slate-900/40 backdrop-blur-xl shadow-2xl shadow-black/40'
              : 'border-[#E7E2DA] bg-white shadow-xs'
          }`}
        >
          {/* Card Header */}
          <div
            className={`flex items-center gap-2.5 px-6 py-4 border-b ${
              isDarkMode
                ? 'border-slate-800/80 bg-slate-950/40 text-slate-100'
                : 'border-[#EFECE6] bg-[#FCFBF9] text-stone-900'
            }`}
          >
            <PlusCircle className="h-5 w-5 text-[#9C7844]" />
            <h1 className="text-sm font-bold tracking-tight">
              Buat Galeri Baru
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Field 1: LINK FOLDER GOOGLE DRIVE (WAJIB) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="driveLink"
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isDarkMode ? 'text-slate-300' : 'text-stone-600'
                    }`}
                  >
                    Link Folder Google Drive
                  </label>
                  <span className="text-[10px] font-bold text-[#9C7844] uppercase">
                    Wajib
                  </span>
                </div>

                {/* Tombol Demo Link untuk Pengujian Cepat */}
                <button
                  type="button"
                  onClick={() => {
                    const demoLink = 'https://drive.google.com/drive/folders/sample-dede-wedding'
                    setDriveLink(demoLink)
                    handleScanLink(demoLink)
                  }}
                  className={`text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    isDarkMode
                      ? 'text-indigo-400 hover:text-indigo-300'
                      : 'text-[#9C7844] hover:underline'
                  }`}
                  title="Gunakan link contoh Google Drive untuk melihat hasil foto"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Contoh Link Drive</span>
                </button>
              </div>

              <div className="relative flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-stone-400">
                  <Link2 className="h-4 w-4" />
                </div>
                <input
                  id="driveLink"
                  type="url"
                  required
                  value={driveLink}
                  onChange={(e) => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className={`w-full rounded-xl border py-2.5 pl-10 pr-24 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                  }`}
                />

                {/* Tombol Pindai di dalam input */}
                <div className="absolute right-1.5 inset-y-1.5 flex items-center">
                  <button
                    type="button"
                    onClick={() => handleScanLink()}
                    disabled={isScanningLink || !driveLink.trim()}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      scannedPhotos.length > 0
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-[#9C7844] text-white hover:bg-[#866535] shadow-xs'
                    }`}
                  >
                    {isScanningLink ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        <span>Scan...</span>
                      </>
                    ) : scannedPhotos.length > 0 ? (
                      <>
                        <Check className="h-3 w-3 stroke-[3]" />
                        <span>Terscan</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span>Pindai</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p
                className={`mt-1.5 text-xs ${
                  isDarkMode ? 'text-slate-400' : 'text-stone-400'
                }`}
              >
                Nama klien otomatis diambil dari nama folder. Folder harus
                di-share &quot;Anyone with the link&quot;.
              </p>

              {/* Status Loading Saat Memindai */}
              {isScanningLink && (
                <div
                  className={`mt-3 flex items-center gap-3 rounded-xl border p-3 text-xs animate-pulse ${
                    isDarkMode
                      ? 'border-indigo-900/50 bg-indigo-950/20 text-indigo-300'
                      : 'border-amber-200 bg-amber-50/60 text-amber-800'
                  }`}
                >
                  <RefreshCw className="h-4 w-4 animate-spin text-[#9C7844]" />
                  <span>
                    Sedang memindai folder Google Drive dan membaca file foto...
                  </span>
                </div>
              )}

              {/* Alert Error Jika Folder Gagal Dibaca */}
              {!isScanningLink && scanError && (
                <div
                  className={`mt-3 rounded-xl border p-3.5 text-xs ${
                    isDarkMode
                      ? 'border-rose-900/50 bg-rose-950/25 text-rose-300'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold">{scanError}</p>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        Tips: Buka Google Drive &gt; Klik kanan folder &gt; Bagikan (Share) &gt;
                        Ubah &quot;Akses umum&quot; menjadi &quot;Siapa saja yang memiliki link&quot; (Pelihat).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* HASIL SCAN: Galeri Foto dari Google Drive */}
              {!isScanningLink && scannedPhotos.length > 0 && (
                <div
                  className={`mt-3.5 rounded-xl border p-4 transition-all animate-in fade-in slide-in-from-top-2 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/80 shadow-lg'
                      : 'border-stone-200 bg-stone-50/70 shadow-xs'
                  }`}
                >
                  {/* Header Hasil Scan */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200/60 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-stone-800 dark:text-slate-200">
                        Hasil Scan Foto Google Drive
                      </span>
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {scannedPhotos.length} Foto Terdeteksi
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {detectedFolderName && (
                        <span className="text-[11px] font-medium text-[#9C7844] bg-[#9C7844]/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <FolderCheck className="h-3 w-3" />
                          <span className="max-w-[160px] truncate">{detectedFolderName}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAllScannedModal(true)}
                        className="text-xs font-semibold text-[#9C7844] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Lihat Semua Foto ({scannedPhotos.length})</span>
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Filmstrip / Compact Grid */}
                  <div className="pt-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {scannedPhotos.slice(0, 6).map((photo, pIdx) => (
                        <div
                          key={photo.id || pIdx}
                          onClick={() => setPreviewLightboxPhoto(photo)}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-stone-200 dark:border-slate-800 bg-stone-200 dark:bg-slate-900 cursor-pointer transition-all hover:scale-[1.03] hover:shadow-md"
                        >
                          <img
                            src={photo.thumbnailUrl || (photo.fileId ? `/api/drive-image?id=${photo.fileId}&sz=800` : photo.url)}
                            alt={photo.filename}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const fileId = photo.fileId || photo.id
                              const target = e.currentTarget
                              if (!target.dataset.triedProxy && fileId) {
                                target.dataset.triedProxy = 'true'
                                target.src = `/api/drive-image?id=${fileId}&sz=800`
                              } else if (photo.url && target.src !== photo.url) {
                                target.src = photo.url
                              }
                            }}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                            <p className="text-[9px] font-mono text-white truncate">
                              {photo.filename}
                            </p>
                          </div>
                        </div>
                      ))}

                      {scannedPhotos.length > 6 && (
                        <button
                          type="button"
                          onClick={() => setShowAllScannedModal(true)}
                          className={`flex flex-col items-center justify-center rounded-lg border border-dashed text-xs font-semibold transition-all cursor-pointer ${
                            isDarkMode
                              ? 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-900'
                              : 'border-stone-300 bg-stone-100/60 text-stone-700 hover:bg-stone-100'
                          }`}
                        >
                          <ImageIcon className="h-5 w-5 text-[#9C7844] mb-1" />
                          <span>+{scannedPhotos.length - 6} Foto</span>
                          <span className="text-[10px] text-stone-400">Klik untuk melihat</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-stone-400 dark:text-slate-500">
                      Klik salah satu foto untuk melihat tampilan penuh (resolusi tinggi).
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Field 2 & 3: BATAS FOTO & BATAS WAKTU (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="maxPhotos"
                  className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ${
                    isDarkMode ? 'text-slate-300' : 'text-stone-600'
                  }`}
                >
                  Batas Maksimal Foto Dipilih Client
                </label>
                <input
                  id="maxPhotos"
                  type="number"
                  min="1"
                  value={maxPhotos}
                  onChange={(e) => setMaxPhotos(e.target.value)}
                  placeholder="60"
                  className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="selectionDeadline"
                  className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ${
                    isDarkMode ? 'text-slate-300' : 'text-stone-600'
                  }`}
                >
                  Batas Waktu Klien Memilih
                </label>
                <div className="relative">
                  <select
                    id="selectionDeadline"
                    value={selectionDeadline}
                    onChange={(e) => setSelectionDeadline(e.target.value)}
                    className={`w-full appearance-none rounded-xl border py-2.5 pl-3.5 pr-10 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 cursor-pointer ${
                      isDarkMode
                        ? 'border-slate-800 bg-slate-950/70 text-slate-100 focus:bg-slate-950'
                        : 'border-stone-200 bg-stone-50/40 text-stone-800 focus:bg-white'
                    }`}
                  >
                    <option value="7 hari" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>7 hari</option>
                    <option value="14 hari" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>14 hari</option>
                    <option value="30 hari" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>30 hari</option>
                    <option value="60 hari" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>60 hari</option>
                    <option value="90 hari" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>90 hari</option>
                    <option value="Tanpa batas" className={isDarkMode ? 'bg-slate-900 text-slate-100' : ''}>Tanpa batas</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p
                  className={`mt-1.5 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-400'
                  }`}
                >
                  Kasih deadline biar klien nggak menunda-nunda. Bisa diubah
                  kapan saja.
                </p>
              </div>
            </div>

            {/* Field 4 & 5: NAMA KLIEN & TANGGAL ACARA (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label
                    htmlFor="clientName"
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isDarkMode ? 'text-slate-300' : 'text-stone-600'
                    }`}
                  >
                    Nama Klien
                  </label>
                  <span className="text-[11px] font-normal text-stone-400">
                    — TIDAK WAJIB
                  </span>
                </div>
                <input
                  id="clientName"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Wisuda Nisa"
                  className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                  }`}
                />
                <p
                  className={`mt-1.5 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-400'
                  }`}
                >
                  Dipakai jadi nama galeri sekaligus album kenangan untuk klien.
                  Kalau dikosongkan, ikut nama folder Google Drive.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label
                    htmlFor="eventDate"
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isDarkMode ? 'text-slate-300' : 'text-stone-600'
                    }`}
                  >
                    Tanggal Acara
                  </label>
                  <span className="text-[11px] font-normal text-stone-400">
                    — TIDAK WAJIB
                  </span>
                </div>
                <input
                  id="eventDate"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 cursor-pointer ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 focus:bg-slate-950 [color-scheme:dark]'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 focus:bg-white'
                  }`}
                />
                <p
                  className={`mt-1.5 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-400'
                  }`}
                >
                  Tampil di halaman Highlight klien.
                </p>
              </div>
            </div>

            {/* Field 6: DESKRIPSI HIGHLIGHT */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <label
                  htmlFor="highlightDescription"
                  className={`text-[11px] font-bold tracking-wider uppercase ${
                    isDarkMode ? 'text-slate-300' : 'text-stone-600'
                  }`}
                >
                  Deskripsi Highlight
                </label>
                <span className="text-[11px] font-normal text-stone-400">
                  — TIDAK WAJIB
                </span>
              </div>
              <input
                id="highlightDescription"
                type="text"
                value={highlightDescription}
                onChange={(e) => setHighlightDescription(e.target.value)}
                placeholder="Your Story in Frames"
                className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                    : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                }`}
              />
              <p
                className={`mt-1.5 text-xs ${
                  isDarkMode ? 'text-slate-400' : 'text-stone-400'
                }`}
              >
                Kalimat kecil di bawah nama klien di halaman Highlight.
                Kosongkan untuk pakai bawaan.
              </p>
            </div>

            {/* Field 7 & 8: EMAIL KLIEN & WHATSAPP KLIEN (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label
                    htmlFor="clientEmail"
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isDarkMode ? 'text-slate-300' : 'text-stone-600'
                    }`}
                  >
                    Email Klien
                  </label>
                  <span className="text-[11px] font-normal text-stone-400">
                    — TIDAK WAJIB
                  </span>
                </div>
                <input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="klien@email.com"
                  className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label
                    htmlFor="clientWhatsapp"
                    className={`text-[11px] font-bold tracking-wider uppercase ${
                      isDarkMode ? 'text-slate-300' : 'text-stone-600'
                    }`}
                  >
                    Whatsapp Klien
                  </label>
                  <span className="text-[10px] font-bold text-[#9C7844] uppercase">
                    Wajib
                  </span>
                </div>
                <input
                  id="clientWhatsapp"
                  type="tel"
                  required
                  value={clientWhatsapp}
                  onChange={handleWhatsappChange}
                  placeholder="08123456789"
                  className={`w-full rounded-xl border py-2.5 px-3.5 text-sm transition-all focus:border-[#9C7844] focus:outline-none focus:ring-2 focus:ring-[#9C7844]/20 ${
                    isDarkMode
                      ? 'border-slate-800 bg-slate-950/70 text-slate-100 placeholder-slate-500 focus:bg-slate-950'
                      : 'border-stone-200 bg-stone-50/40 text-stone-800 placeholder-stone-400 focus:bg-white'
                  }`}
                />
                <p
                  className={`mt-1.5 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-400'
                  }`}
                >
                  Hanya angka. Spasi dan tanda hubung otomatis dibuang.
                </p>
              </div>
            </div>

            {/* Field 9: Checkbox Download Permission */}
            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={allowDownload}
                    onChange={(e) => setAllowDownload(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`h-4 w-4 rounded flex items-center justify-center border transition-all ${
                      allowDownload
                        ? 'bg-[#9C7844] border-[#9C7844] text-white shadow-2xs'
                        : isDarkMode
                        ? 'border-slate-700 bg-slate-950 group-hover:border-slate-600'
                        : 'border-stone-300 bg-white group-hover:border-stone-400'
                    }`}
                  >
                    {allowDownload && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
                <div>
                  <span
                    className={`text-xs font-semibold ${
                      isDarkMode ? 'text-slate-200' : 'text-stone-700'
                    }`}
                  >
                    Izinkan klien mengunduh foto
                  </span>
                  <p
                    className={`text-xs mt-0.5 ${
                      isDarkMode ? 'text-slate-400' : 'text-stone-400'
                    }`}
                  >
                    Kalau dimatikan, klien hanya bisa melihat foto, tidak bisa
                    download.
                  </p>
                </div>
              </label>
            </div>

            {/* Bottom Actions */}
            <div
              className={`pt-6 border-t flex flex-col sm:flex-row items-center justify-end gap-4 ${
                isDarkMode ? 'border-slate-800/80' : 'border-[#EFECE6]'
              }`}
            >
              {!clientWhatsapp.trim() && (
                <span
                  className={`text-xs font-medium ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-500'
                  }`}
                >
                  Isi WhatsApp klien dulu.
                </span>
              )}

              <button
                type="submit"
                disabled={!isFormValid || isScanningModalOpen}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#9C7844] px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#8B6B3C] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
                <span>Buat Galeri</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section: Semua Galeri */}
        <div className="mt-12">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-[#9C7844] rounded-full inline-block" />
              <h2
                className={`text-sm font-bold tracking-tight ${
                  isDarkMode ? 'text-slate-100' : 'text-stone-800'
                }`}
              >
                Semua Galeri
              </h2>
            </div>
            <span
              className={`text-xs font-medium ${
                isDarkMode ? 'text-slate-400' : 'text-stone-400'
              }`}
            >
              {galleries.length} galeri
            </span>
          </div>

          {/* Galleries List */}
          <div className="space-y-4">
            {galleries.length === 0 ? (
              <div
                className={`rounded-2xl border p-8 text-center ${
                  isDarkMode
                    ? 'border-slate-800/80 bg-slate-900/40 text-slate-400'
                    : 'border-stone-200 bg-white text-stone-500'
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-500/10 mb-3">
                  <Trash2 className="h-6 w-6 opacity-40" />
                </div>
                <p className="text-sm font-semibold">Belum Ada Galeri</p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Galeri yang telah dihapus tidak akan muncul lagi di sini. Masukkan link Google Drive di formulir atas untuk membuat galeri baru.
                </p>
              </div>
            ) : (
              galleries.map((gallery) => {
                const initial = (
                  gallery.clientName.trim()[0] || 'K'
                ).toUpperCase()

              return (
                <div
                  key={gallery.id}
                  className={`rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all ${
                    isDarkMode
                      ? 'border-slate-800/80 bg-slate-900/40 backdrop-blur-md hover:border-slate-700 text-slate-100'
                      : 'border-[#E7DFD4] bg-white text-stone-900 hover:border-[#DACFBF]'
                  }`}
                >
                  {/* Top Row: Client Info, Progress, Status, Action Buttons */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Avatar + Details */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Avatar Squircle */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-base font-bold ${
                          isDarkMode
                            ? 'border-slate-700 bg-slate-800 text-slate-200'
                            : 'border-[#E9DFD0] bg-[#F6F1EA] text-stone-700'
                        }`}
                      >
                        {initial}
                      </div>

                      {/* Info & Progress */}
                      <div className="space-y-1.5">
                        <h3
                          className={`text-sm font-bold leading-tight ${
                            isDarkMode ? 'text-white' : 'text-stone-900'
                          }`}
                        >
                          {gallery.clientName}
                        </h3>

                        <div
                          className={`flex flex-wrap items-center gap-2 text-xs ${
                            isDarkMode ? 'text-slate-400' : 'text-stone-400'
                          }`}
                        >
                          <span>{gallery.date}</span>
                          <span>•</span>
                          <span>Maks. {gallery.maxPhotos} foto</span>
                          <span>•</span>
                          <span>Sisa {gallery.remainingDays} hari</span>
                        </div>

                        {/* Progress Bar Row */}
                        <div className="flex items-center gap-2.5 pt-0.5">
                          <div
                            className={`h-1.5 w-36 sm:w-44 overflow-hidden rounded-full ${
                              isDarkMode ? 'bg-slate-800' : 'bg-[#EBE6DD]'
                            }`}
                          >
                            <div
                              className="h-full rounded-full bg-[#9C7844]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (gallery.selectedPhotos / gallery.maxPhotos) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              isDarkMode ? 'text-slate-400' : 'text-stone-500'
                            }`}
                          >
                            {gallery.selectedPhotos}/{gallery.maxPhotos}
                          </span>
                        </div>

                        {/* Client view status */}
                        <div
                          className={`flex items-center gap-1.5 text-[11px] pt-0.5 ${
                            isDarkMode ? 'text-slate-400' : 'text-stone-400'
                          }`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            {gallery.isClientViewed
                              ? 'Sudah dibuka klien'
                              : 'Belum dibuka klien'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Pill & Action Buttons */}
                    <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 pt-2 md:pt-0">
                      {/* Status Pill */}
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          isDarkMode
                            ? 'bg-slate-800 text-slate-300'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {gallery.status}
                      </span>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={() => openShareModalForGallery(gallery)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1E824C] text-white hover:bg-[#16683C] transition-colors cursor-pointer shadow-2xs"
                        title="Kirim Galeri via WhatsApp"
                      >
                        <svg
                          className="h-4 w-4 fill-current"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.584 1.782.914 2.802.914 3.183 0 5.769-2.586 5.769-5.767.001-3.182-2.583-5.767-5.769-5.767zm3.398 8.163c-.143.404-.714.743-1.002.779-.272.034-.627.15-2.073-.448-1.745-.724-2.871-2.493-2.958-2.608-.088-.117-.704-.937-.704-1.789 0-.853.447-1.272.606-1.446.16-.175.349-.219.465-.219.117 0 .233.001.334.006.107.005.25-.041.391.298.144.35.494 1.206.537 1.294.043.088.072.19.014.307-.058.117-.088.19-.175.292-.087.102-.184.228-.263.307-.088.087-.18.182-.077.359.102.175.455.751.977 1.216.671.597 1.236.782 1.411.87.175.088.277.073.38-.044.102-.117.437-.51.554-.685.117-.175.234-.146.393-.088.16.059 1.011.477 1.185.565.175.088.291.131.334.204.044.073.044.423-.099.827z" />
                        </svg>
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const safeSlug =
                            gallery.slug ||
                            gallery.clientName
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, '-')
                              .replace(/-+/g, '-')
                              .replace(/^-|-$/g, '') ||
                            gallery.id
                          const link = `${window.location.origin}/livesotory-co/${safeSlug}`
                          navigator.clipboard?.writeText(link)
                          showToast(
                            `Link kurasi ${gallery.clientName} berhasil disalin!`
                          )
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-300'
                        }`}
                        title="Salin Link Klien"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      {/* Download Cloud Button */}
                      <button
                        type="button"
                        onClick={() =>
                          showToast('Membuka folder Google Drive...')
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-300'
                        }`}
                        title="Buka Drive Foto"
                      >
                        <CloudDownload className="h-3.5 w-3.5" />
                      </button>

                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() =>
                          showToast(`Edit data ${gallery.clientName}`)
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-300'
                        }`}
                        title="Edit Galeri"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Settings Button */}
                      <button
                        type="button"
                        onClick={() =>
                          showToast(
                            `Pengaturan galeri ${gallery.clientName}`
                          )
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-300'
                        }`}
                        title="Pengaturan"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </button>

                      {/* History Clock Button */}
                      <button
                        type="button"
                        onClick={() => showToast('Riwayat aktivitas klien')}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-stone-800 hover:border-stone-300'
                        }`}
                        title="Riwayat Pemilihan"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setGalleryToDelete(gallery)
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 hover:bg-rose-950/30'
                            : 'border-stone-200 bg-white text-stone-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
                        }`}
                        title="Hapus Galeri"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Strip: Update Foto Editan + Gratis */}
                  <div
                    onClick={() =>
                      showToast(
                        'Memperbarui foto editan dari Google Drive...'
                      )
                    }
                    className={`mt-4 rounded-xl border px-4 py-2.5 flex items-center justify-between transition-colors cursor-pointer group ${
                      isDarkMode
                        ? 'border-slate-800/90 bg-slate-950/60 hover:bg-slate-900/80 text-[#C9A26A]'
                        : 'border-[#E7DFD4] bg-[#FDFCFB] hover:bg-[#FAF7F1] text-[#9C7844]'
                    }`}
                  >
                    <div className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold group-hover:opacity-90">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Update Foto Editan</span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        isDarkMode
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                      }`}
                    >
                      Gratis
                    </span>
                  </div>
                </div>
              )
            })
            )}
          </div>
        </div>
      </main>

      {/* Modal Scanning Folder Google Drive */}
      {isScanningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-[460px] rounded-3xl p-7 sm:p-9 shadow-2xl border transition-all ${
              isDarkMode
                ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/80 backdrop-blur-2xl'
                : 'bg-white border-stone-100 text-stone-900 shadow-stone-950/20'
            }`}
          >
            {/* Squircle Refresh Icon */}
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl mb-5 ${
                isDarkMode
                  ? 'bg-slate-800/80 text-[#C9A26A]'
                  : 'bg-[#F6F1EA] text-[#9C7844]'
              }`}
            >
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>

            {/* Title & Description */}
            <h3
              className={`text-xl font-bold tracking-tight ${
                isDarkMode ? 'text-white' : 'text-stone-900'
              }`}
            >
              Memindai folder Drive...
            </h3>
            <p
              className={`mt-2 text-sm leading-relaxed ${
                isDarkMode ? 'text-slate-400' : 'text-stone-500'
              }`}
            >
              Sedang membaca semua foto di folder. Folder besar bisa butuh 1–2
              menit — jangan tutup halaman ini.
            </p>

            {/* Progress Bar & Subtext */}
            <div className="mt-6">
              <div
                className={`h-2 w-full overflow-hidden rounded-full ${
                  isDarkMode ? 'bg-slate-800' : 'bg-[#F3EFE9]'
                }`}
              >
                <div
                  className="h-full rounded-full bg-[#9C7844] transition-all duration-500 ease-out"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>

              {/* Status Below */}
              <p
                className={`mt-4 text-center text-xs font-medium ${
                  isDarkMode ? 'text-slate-400' : 'text-stone-500'
                }`}
              >
                {scanStatusText}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Galeri Siap Dikirim 🎉 */}
      {isShareModalOpen && shareModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-[460px] rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
              isDarkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/80'
                : 'bg-white border-stone-200/80 text-stone-900 shadow-stone-950/20'
            }`}
          >
            {/* Header */}
            <h3 className="text-xl font-bold tracking-tight text-stone-900 dark:text-white">
              Galeri siap dikirim 🎉
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
              Kirim ke{' '}
              <strong className="font-semibold text-stone-800 dark:text-slate-200">
                {shareModalData.clientName.toUpperCase()}
              </strong>{' '}
              lewat WhatsApp — teks & link sudah disiapkan otomatis.
            </p>

            {/* Big Green WhatsApp Button */}
            <button
              type="button"
              onClick={() => {
                let cleanPhone = shareModalData.whatsapp.replace(/\D/g, '')
                if (cleanPhone.startsWith('0')) {
                  cleanPhone = '62' + cleanPhone.slice(1)
                }
                const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(
                  shareModalData.fullMessage
                )}`
                window.open(waUrl, '_blank')
              }}
              className="mt-5 w-full flex items-center justify-center gap-2.5 rounded-2xl bg-[#1E7E34] hover:bg-[#16682B] text-white py-3.5 px-4 font-bold text-sm shadow-md shadow-[#1E7E34]/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.698c.969.584 1.782.914 2.802.914 3.183 0 5.769-2.586 5.769-5.767.001-3.182-2.583-5.767-5.769-5.767zm3.398 8.163c-.143.404-.714.743-1.002.779-.272.034-.627.15-2.073-.448-1.745-.724-2.871-2.493-2.958-2.608-.088-.117-.704-.937-.704-1.789 0-.853.447-1.272.606-1.446.16-.175.349-.219.465-.219.117 0 .233.001.334.006.107.005.25-.041.391.298.144.35.494 1.206.537 1.294.043.088.072.19.014.307-.058.117-.088.19-.175.292-.087.102-.184.228-.263.307-.088.087-.18.182-.077.359.102.175.455.751.977 1.216.671.597 1.236.782 1.411.87.175.088.277.073.38-.044.102-.117.437-.51.554-.685.117-.175.234-.146.393-.088.16.059 1.011.477 1.185.565.175.088.291.131.334.204.044.073.044.423-.099.827z" />
              </svg>
              <span>Kirim ke Klien via WhatsApp</span>
            </button>

            {/* Label Section */}
            <h4
              className={`mt-5 text-[11px] font-bold tracking-wider uppercase ${
                isDarkMode ? 'text-[#C9A26A]' : 'text-[#9C7844]'
              }`}
            >
              PESAN LENGKAP — SIAP KIRIM KE KLIEN
            </h4>

            {/* Message Textarea */}
            <div className="mt-2 relative">
              <textarea
                readOnly
                value={shareModalData.fullMessage}
                rows={9}
                className={`w-full resize-none rounded-2xl border p-3.5 font-sans text-xs leading-relaxed transition-all focus:outline-none select-all ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-950 text-slate-200'
                    : 'border-stone-200 bg-[#FBF9F5] text-stone-800'
                }`}
              />
            </div>

            {/* Quick Direct Link Preview Buttons */}
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <a
                href={shareModalData.selectionLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold text-center transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-[#9C7844]/40 bg-[#9C7844]/15 hover:bg-[#9C7844]/25 text-[#E8C28A]'
                    : 'border-[#9C7844]/30 bg-[#FAF3E8] hover:bg-[#F5EAD8] text-[#9C7844]'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Buka Link Seleksi</span>
              </a>
              <a
                href={shareModalData.albumLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold text-center transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                    : 'border-stone-200 bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Buka Album</span>
              </a>
            </div>

            {/* Copy Full Message Button */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(shareModalData.fullMessage)
                showToast('Pesan lengkap berhasil disalin!')
              }}
              className="mt-2.5 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#B89255] hover:bg-[#A58045] text-white py-3.5 px-4 font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer"
            >
              <Copy className="h-4 w-4" />
              <span>Salin Pesan Lengkap</span>
            </button>

            {/* Help Caption */}
            <p className="mt-2 text-xs text-stone-500 dark:text-slate-400 text-center">
              Teks + link seleksi + link Memories jadi satu. Tinggal tempel di chat klien.
            </p>

            {/* Cancel Button */}
            <div className="mt-4 pt-1">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className={`rounded-xl border px-5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                Nanti saja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Foto Google Drive Resolusi Penuh */}
      {previewLightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
          <button
            type="button"
            onClick={() => setPreviewLightboxPhoto(null)}
            className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative max-h-[85vh] max-w-[90vw] flex flex-col items-center">
            <img
              src={previewLightboxPhoto.url || previewLightboxPhoto.thumbnailUrl || (previewLightboxPhoto.fileId ? `/api/drive-image?id=${previewLightboxPhoto.fileId}&sz=1600` : '')}
              alt={previewLightboxPhoto.filename}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const fileId = previewLightboxPhoto.fileId || previewLightboxPhoto.id
                const target = e.currentTarget
                if (!target.dataset.triedProxy && fileId) {
                  target.dataset.triedProxy = 'true'
                  target.src = `/api/drive-image?id=${fileId}&sz=1600`
                } else if (
                  previewLightboxPhoto.thumbnailUrl &&
                  target.src !== previewLightboxPhoto.thumbnailUrl
                ) {
                  target.src = previewLightboxPhoto.thumbnailUrl
                }
              }}
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 backdrop-blur-md border border-white/10">
              <span className="font-mono text-xs text-white">
                {previewLightboxPhoto.filename}
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20">
                Google Drive Stream
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grid Lengkap Foto Terdeteksi dari Google Drive */}
      {showAllScannedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div
            className={`w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
              isDarkMode
                ? 'border-slate-800 bg-slate-900 text-slate-100'
                : 'border-stone-200 bg-white text-stone-900'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#9C7844]/15 text-[#9C7844]">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Foto Terdeteksi dari Google Drive
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    Total {scannedPhotos.length} foto siap digunakan langsung
                    {detectedFolderName ? ` • Folder: ${detectedFolderName}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Photo Grid */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {scannedPhotos.map((photo, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => setPreviewLightboxPhoto(photo)}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-slate-800 bg-stone-100 dark:bg-slate-950 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                  >
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.filename}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (photo.url && e.currentTarget.src !== photo.url) {
                          e.currentTarget.src = photo.url
                        }
                      }}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                      <p className="text-[10px] font-mono text-white truncate">
                        {photo.filename}
                      </p>
                      <span className="text-[9px] text-[#C9A26A] font-semibold">
                        Klik untuk perbesar
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-950/40">
              <span className="text-xs text-stone-500 dark:text-slate-400">
                Semua foto dialirkan langsung dari Google Drive CDN
              </span>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="rounded-xl bg-[#9C7844] hover:bg-[#866535] px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Selesai Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Galeri */}
      {galleryToDelete && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setGalleryToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDarkMode
                ? 'border-slate-800 bg-[#0d131f] text-slate-100 shadow-black/80'
                : 'border-stone-200 bg-white text-stone-900 shadow-stone-900/10'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Hapus Galeri?</h3>
                <p className="text-xs text-stone-500 dark:text-slate-400">
                  Tindakan ini permanen
                </p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-stone-600 dark:text-slate-300 mb-6">
              Apakah Anda yakin ingin menghapus galeri{' '}
              <strong className="text-stone-900 dark:text-white font-semibold">
                &ldquo;{galleryToDelete.clientName}&rdquo;
              </strong>
              ? Data galeri dan pilihan foto klien akan dihapus secara permanen.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setGalleryToDelete(null)}
                className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteGallery(galleryToDelete)}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
              >
                Ya, Hapus Galeri
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}