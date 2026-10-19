import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  Share2,
  Download,
  Lock,
  Image as ImageIcon,
  KeyRound,
  Copy,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Eye,
  CheckCircle2,
} from 'lucide-react'
import {
  findGalleryBySlug,
  fetchGalleryBySlug,
  saveOrUpdateGallery,
  getStoredGalleries,
  incrementGalleryViewCount,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'

export default function AlbumShare() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [gallery, setGallery] = useState<GalleryData | null>(() => {
    try {
      let rawSlug = slug ? decodeURIComponent(slug).trim() : ''
      if (!rawSlug) {
        const segments = window.location.pathname.split('/').filter(Boolean)
        const last = segments[segments.length - 1]
        if (last && !last.startsWith('album') && !last.startsWith('livesotory')) {
          rawSlug = decodeURIComponent(last).trim()
        }
      }
      const cleanSlug = rawSlug.replace(/-3$/, '')
      return (
        (cleanSlug ? findGalleryBySlug(cleanSlug) : null) ||
        getStoredGalleries()[0] ||
        null
      )
    } catch {
      return null
    }
  })
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('semua')

  // Splash Screen State
  const [isSplashActive, setIsSplashActive] = useState<boolean>(true)
  const [isSplashFading, setIsSplashFading] = useState<boolean>(false)

  const handleDismissSplash = () => {
    setIsSplashFading(true)
    setTimeout(() => {
      setIsSplashActive(false)
    }, 650)
  }

  // Auto transition after 3.2 seconds if not clicked manually
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismissSplash()
    }, 3200)
    return () => clearTimeout(timer)
  }, [])

  // Modals for the features requested:
  // "(bisa atur siapa yang lihat, ganti sampul, bikin pin)"
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [isPinLocked, setIsPinLocked] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [aspectMap, setAspectMap] = useState<Record<string, 'portrait' | 'landscape'>>({})

  useEffect(() => {
    try {
      let rawSlug = slug ? decodeURIComponent(slug).trim() : ''
      if (!rawSlug) {
        const segments = location.pathname.split('/').filter(Boolean)
        const last = segments[segments.length - 1]
        if (last && !last.startsWith('album') && !last.startsWith('livesotory')) {
          rawSlug = decodeURIComponent(last).trim()
        }
      }
      const cleanSlug = rawSlug.replace(/-3$/, '')

      const applyGallery = (data: GalleryData) => {
        const sessionKey = `livein_album_view_${data.id}`
        if (!sessionStorage.getItem(sessionKey)) {
          const updated = incrementGalleryViewCount(data.slug || data.id)
          if (updated) {
            setGallery(updated)
            sessionStorage.setItem(sessionKey, '1')
          } else {
            setGallery(data)
          }
        } else {
          setGallery(data)
        }

        if (data.pinCode) {
          setIsPinLocked(true)
        }
        if (data.clientName) {
          document.title = `${data.clientName} — Album Kenangan`
        }
      }

      const localData =
        (cleanSlug ? findGalleryBySlug(cleanSlug) : null) ||
        getStoredGalleries()[0] ||
        null

      if (localData) {
        applyGallery(localData)
      }

      if (cleanSlug) {
        fetchGalleryBySlug(cleanSlug).then((remoteData) => {
          if (remoteData) {
            applyGallery(remoteData)
          }
        })
      }
    } catch (e) {
      console.error('[AlbumShare] Error loading gallery:', e)
    }
  }, [slug, location.pathname])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSetPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gallery) return
    const updated = { ...gallery, pinCode: pinInput.trim() || undefined }
    setGallery(updated)
    saveOrUpdateGallery(updated)
    setIsPinModalOpen(false)
    showToast(
      pinInput.trim()
        ? 'PIN album berhasil diatur!'
        : 'PIN album dinonaktifkan (publik).'
    )
  }

  const handleChangeCover = (photoUrl: string) => {
    if (!gallery) return
    const updated = { ...gallery, coverUrl: photoUrl }
    setGallery(updated)
    saveOrUpdateGallery(updated)
    setIsCoverModalOpen(false)
    showToast('Foto sampul album berhasil diganti!')
  }

  const handleShareWhatsApp = () => {
    if (!gallery) return
    const shareUrl = window.location.href
    const text = `Lihat album foto kenangan ${gallery.clientName} dari Livesostory.co:\n${shareUrl}`
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
      '_blank'
    )
  }


  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
    showToast('Link album berhasil disalin!')
  }

  const photos = Array.isArray(gallery?.photos) ? gallery.photos : []

  // Extract unique available categories dynamically
  const availableCategories = Array.from(
    new Set(
      photos
        .map((p) => (p && p.category ? String(p.category).trim() : ''))
        .filter((cat): cat is string => Boolean(cat && cat.length > 0))
    )
  )

  const filteredPhotos = photos.filter((p) => {
    if (!p) return false
    if (availableCategories.length > 1 && activeCategory !== 'semua') {
      if ((p.category || '').trim() !== activeCategory) return false
    }
    return true
  })


  const handlePrevPhoto = () => {
    if (filteredPhotos.length === 0) return
    const prev = (activePhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length
    setActivePhotoIndex(prev)
    setActivePhoto(filteredPhotos[prev])
  }

  const handleNextPhoto = () => {
    if (filteredPhotos.length === 0) return
    const next = (activePhotoIndex + 1) % filteredPhotos.length
    setActivePhotoIndex(next)
    setActivePhoto(filteredPhotos[next])
  }

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!activePhoto || !gallery) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePhoto(null)
      } else if (e.key === 'ArrowLeft') {
        handlePrevPhoto()
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePhoto, activePhotoIndex, gallery, filteredPhotos])

  // Touch gesture handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStartX || !touchEndX) return
    const distance = touchStartX - touchEndX
    const minSwipeDistance = 45
    if (distance > minSwipeDistance) {
      handleNextPhoto()
    } else if (distance < -minSwipeDistance) {
      handlePrevPhoto()
    }
    setTouchStartX(null)
    setTouchEndX(null)
  }

  const handleSharePhoto = async (photo: GalleryPhoto) => {
    const shareUrl = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${gallery?.clientName || 'Livein'} - ${photo.filename}`,
          text: `Lihat foto ${photo.filename} dari album kenangan ${gallery?.clientName}:`,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard?.writeText(photo.url || shareUrl)
    showToast('Tautan foto berhasil disalin!')
  }

  const handleDownloadPhoto = async (photo: GalleryPhoto) => {
    setIsDownloading(true)
    showToast(`Mengunduh ${photo.filename}...`)
    try {
      // 1. Try server proxy endpoint for direct clean filename download
      const proxyUrl = `/api/download-photo?id=${encodeURIComponent(photo.fileId || '')}&url=${encodeURIComponent(photo.url)}&filename=${encodeURIComponent(photo.filename)}`
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const blob = await res.blob()
        const blobUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = photo.filename || 'photo.jpg'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(blobUrl)
        showToast(`Foto ${photo.filename} berhasil diunduh!`)
        setIsDownloading(false)
        return
      }
    } catch (e) {
      console.warn('Proxy download error, falling back:', e)
    }

    // 2. Direct Google Drive direct download fallback
    try {
      const directUrl = photo.fileId
        ? `https://drive.google.com/uc?export=download&id=${photo.fileId}`
        : photo.url
      const a = document.createElement('a')
      a.href = directUrl
      a.download = photo.filename || 'photo.jpg'
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      showToast(`Mengunduh ${photo.filename}...`)
    } catch {
      window.open(photo.url, '_blank')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!gallery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16] text-white p-6 text-center">
        <h1 className="text-xl font-bold">Album Tidak Ditemukan</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-md">
          Tautan album &ldquo;{slug}&rdquo; tidak ditemukan atau sedang dipersiapkan.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              const latest = getStoredGalleries()[0] || null
              if (latest) {
                setGallery(latest)
              }
            }}
            className="rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold px-5 py-2.5 text-xs shadow-lg cursor-pointer hover:brightness-110"
          >
            Buka Album Terbaru
          </button>
          <Link
            to="/login"
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            Masuk ke Portal
          </Link>
        </div>
      </div>
    )
  }

  if (isPinLocked && gallery.pinCode) {
    const handleUnlock = (e: React.FormEvent) => {
      e.preventDefault()
      if (enteredPin === gallery.pinCode) {
        setIsPinLocked(false)
        setPinError(null)
      } else {
        setPinError('PIN salah, silakan coba lagi.')
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090D16] text-white p-4">
        <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 mb-4">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Album Terkunci dengan PIN</h2>
          <p className="text-xs text-slate-400 mt-1.5 mb-6">
            Masukkan PIN untuk membuka galeri foto <strong>{gallery.clientName}</strong>.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            {pinError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                {pinError}
              </div>
            )}
            <input
              type="password"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="Masukkan PIN"
              className="w-full text-center tracking-widest text-lg font-mono rounded-xl border border-slate-800 bg-slate-950 p-3 text-white focus:border-[#C9A26A] focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] py-3 text-xs font-bold text-slate-950 shadow-lg hover:brightness-110 cursor-pointer"
            >
              Buka Album
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 selection:bg-[#9C7844] selection:text-white pb-24">
      {/* Luxury Cinematic Splash Screen */}
      {isSplashActive && gallery && (
        <div
          onClick={handleDismissSplash}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer select-none transition-all duration-700 ${
            isSplashFading
              ? 'opacity-0 scale-105 pointer-events-none'
              : 'opacity-100 scale-100'
          }`}
        >
          {/* Blurred Background Photo with Luxury Vignette */}
          <div className="absolute inset-0 bg-[#090D16]">
            <img
              src={gallery.coverUrl || photos[0]?.url || ''}
              alt="Splash Cover"
              className="h-full w-full object-cover filter brightness-[0.22] blur-xs scale-105 transition-transform duration-3000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090D16] via-[#090D16]/60 to-[#090D16]/75" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#090D16_75%)]" />
          </div>

          {/* Splash Content Box */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-xl animate-in fade-in zoom-in-95 duration-1000">
            {/* Brand Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C9A26A]/40 bg-black/60 backdrop-blur-md px-4 py-1.5 shadow-xl mb-6">
              <Sparkles className="h-3.5 w-3.5 text-[#E8C28A] animate-pulse" />
              <span className="text-[11px] font-bold tracking-widest text-[#E8C28A] uppercase">
                Livesostory.co • Digital Album
              </span>
            </div>

            {/* Album / Client Title */}
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-2xl font-serif">
              {gallery.clientName}
            </h1>

            <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-[#C9A26A] to-transparent my-4" />

            <p className="text-xs sm:text-sm text-slate-300 tracking-wide">
              {gallery.date ? `Diabadikan pada ${gallery.date}` : 'Koleksi Foto Kenangan'} • {photos.length} Foto Kenangan
            </p>

            {/* Open Album CTA Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDismissSplash()
              }}
              className="mt-8 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#9C7844] via-[#C9A26A] to-[#E8C28A] px-7 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-2xl shadow-[#C9A26A]/40 hover:brightness-110 active:scale-95 transition-all cursor-pointer group"
            >
              <span>Buka Album Kenangan</span>
              <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            </button>

            <span className="mt-4 text-[10px] text-white/40 tracking-wider">
              Ketuk di mana saja untuk membuka
            </span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-stone-900 border border-stone-700 px-5 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-xl animate-in fade-in">
          <Sparkles className="h-4 w-4 text-[#C9A26A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Full-Bleed Clean Cover Photo (Tidak tertimpa teks) */}
      <section className="relative w-full overflow-hidden bg-slate-950">
        <div className="w-full h-[360px] sm:h-[460px] lg:h-[520px]">
          <img
            src={gallery.coverUrl || (Array.isArray(gallery.photos) && gallery.photos[0]?.url) || ''}
            alt="Album Cover"
            className="h-full w-full object-cover brightness-95 transition-transform duration-700 hover:scale-[1.01]"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#090D16] to-transparent pointer-events-none" />
        </div>
      </section>

      {/* 2. Centered Editorial Album Title & Info (Di tengah, layout rapi & bersih) */}
      <section className="relative w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-6 flex flex-col items-center text-center">
        {/* PHOTO BY Livesostory.co (Matching Contoh Gambar 2) */}
        <div className="flex flex-col items-center justify-center mb-2.5">
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.3em] uppercase text-slate-400">
            P H O T O &nbsp; B Y
          </span>
          <span className="font-serif text-2xl sm:text-3xl font-normal tracking-wide text-white mt-1">
            Livesostory.co
          </span>
        </div>

        {/* Album Title (Matching Contoh Gambar 1) */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white max-w-3xl font-serif mt-1">
          {gallery.clientName} &amp; Moments
        </h1>

        {/* Album Subtitle & Views */}
        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-slate-400 mt-2 flex-wrap">
          <span>{gallery.date || 'Tanpa Tanggal'}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <Eye className="h-3.5 w-3.5 text-[#C9A26A]" />
            <span>Dibuka {gallery.viewCount || 1}x</span>
          </span>
          <span>•</span>
          <span>{photos.length} Foto</span>
        </div>

        {/* Action Buttons Toolbar (Centered) */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => setIsCoverModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-md hover:text-white"
            title="Ganti Foto Sampul"
          >
            <ImageIcon className="h-3.5 w-3.5 text-[#E8C28A]" />
            <span>Ganti Sampul</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setPinInput(gallery.pinCode || '')
              setIsPinModalOpen(true)
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer shadow-md ${
              gallery.pinCode
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                : 'border-slate-800 bg-slate-900/90 text-slate-200 hover:bg-slate-800 hover:text-white'
            }`}
            title="Atur Siapa yang Melihat / PIN"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#E8C28A]" />
            <span>{gallery.pinCode ? 'PIN Aktif' : 'Bikin PIN'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 rounded-full bg-[#1E824C] hover:bg-[#16683C] px-4 py-1.5 text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Bagikan WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-all cursor-pointer shadow-md hover:text-white"
            title="Salin Link Album"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Salin Link</span>
          </button>
        </div>

        {/* Tombol Lihat Foto Pilihan Klien */}
        {(gallery.selectedPhotos || 0) > 0 && (
          <Link
            to={`/gallery/${gallery.slug}?tab=terpilih`}
            className="mt-4 flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-600/20 hover:bg-blue-600 hover:border-blue-600 text-blue-200 hover:text-white px-5 py-2 text-xs sm:text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 text-blue-400" />
            <span>Lihat {gallery.selectedPhotos} Foto Pilihan Klien</span>
          </Link>
        )}
      </section>

      {/* Album Photos Responsive Grid (Edge-to-edge neat layout) */}
      <main className="w-full px-3 sm:px-5 lg:px-8 pt-8 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {activeCategory === 'semua' ? 'Semua Momen' : activeCategory} ({filteredPhotos.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Streaming langsung dari Google Drive • Kualitas HD
            </p>
          </div>

          {/* Sub-Folder Category Tabs (hanya tampil jika Drive memiliki lebih dari 1 subfolder/kategori) */}
          {availableCategories.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory('semua')}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === 'semua'
                    ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md ring-2 ring-white/20'
                    : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Semua ({photos.length})
              </button>

              {availableCategories.map((cat) => {
                const count = photos.filter((p) => p && (p.category || '').trim() === cat).length
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md ring-2 ring-white/20'
                        : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {filteredPhotos.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-slate-500">Tidak ada foto pada kategori ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-4.5 auto-rows-[135px] sm:auto-rows-[165px] lg:auto-rows-[195px] grid-flow-row-dense">
            {filteredPhotos.map((photo, index) => {
              const isPortrait = (aspectMap[photo.id] || photo.aspect) === 'portrait'

              return (
                <div
                  key={photo.id}
                  onClick={() => {
                    setActivePhotoIndex(index)
                    setActivePhoto(photo)
                  }}
                  className={`group relative overflow-hidden rounded-md border border-slate-800/80 bg-slate-900/60 cursor-pointer transition-all duration-300 hover:border-[#C9A26A]/70 hover:shadow-xl hover:shadow-black/70 hover:-translate-y-0.5 ${
                    isPortrait ? 'row-span-2' : 'row-span-1'
                  }`}
                >
                  <img
                    src={photo.thumbnailUrl || (photo.fileId ? `/api/drive-image?id=${photo.fileId}&sz=800` : photo.url)}
                    alt={photo.filename}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onLoad={(e) => {
                      const { naturalWidth, naturalHeight } = e.currentTarget
                      if (naturalWidth && naturalHeight) {
                        const detected = naturalWidth < naturalHeight ? 'portrait' : 'landscape'
                        if (detected !== (photo.aspect || 'portrait') && aspectMap[photo.id] !== detected) {
                          setAspectMap((prev) => ({ ...prev, [photo.id]: detected }))
                        }
                      }
                    }}
                    onError={(e) => {
                      const fileId = photo.fileId || photo.id
                      const target = e.currentTarget
                      if (!target.dataset.triedProxy && fileId) {
                        target.dataset.triedProxy = 'true'
                        target.src = `/api/drive-image?id=${fileId}&sz=800`
                      } else if (!target.dataset.triedDirect && fileId) {
                        target.dataset.triedDirect = 'true'
                        target.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
                      } else if (photo.url && target.src !== photo.url) {
                        target.src = photo.url
                      }
                    }}
                    className="w-full h-full object-cover block transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="font-mono text-[9px] sm:text-[10px] text-white bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs truncate max-w-[75%]">
                      {photo.filename}
                    </span>
                    <span className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded bg-white/20 text-white backdrop-blur-xs">
                      <Maximize2 className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal (Exact Matching Contoh Gambar 1) */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Top Left: Counter (e.g. 2 / 80) */}
            <div className="pointer-events-auto text-sm sm:text-base font-normal tracking-wide text-white/90">
              {activePhotoIndex + 1} / {filteredPhotos.length || 1}
            </div>

            {/* Top Right: Share, Download, Close */}
            <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => handleSharePhoto(activePhoto)}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
                title="Bagikan Foto"
              >
                <Share2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </button>

              {gallery?.allowDownload !== false && (
                <button
                  type="button"
                  onClick={() => handleDownloadPhoto(activePhoto)}
                  disabled={isDownloading}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg disabled:opacity-50"
                  title="Unduh Foto"
                >
                  {isDownloading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Download className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
                title="Tutup"
              >
                <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Left Arrow */}
          <button
            type="button"
            onClick={handlePrevPhoto}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={handleNextPhoto}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
            title="Foto Selanjutnya"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Center Main Photo Container */}
          <div
            className="relative flex h-full w-full items-center justify-center p-3 sm:p-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={activePhoto.url || activePhoto.thumbnailUrl || (activePhoto.fileId ? `/api/drive-image?id=${activePhoto.fileId}&sz=1600` : '')}
              alt={activePhoto.filename}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const fileId = activePhoto.fileId || activePhoto.id
                const target = e.currentTarget
                if (!target.dataset.triedProxy && fileId) {
                  target.dataset.triedProxy = 'true'
                  target.src = `/api/drive-image?id=${fileId}&sz=1600`
                } else if (!target.dataset.triedDirect && fileId) {
                  target.dataset.triedDirect = 'true'
                  target.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`
                } else if (activePhoto.thumbnailUrl && target.src !== activePhoto.thumbnailUrl) {
                  target.src = activePhoto.thumbnailUrl
                }
              }}
              className="max-h-[82vh] sm:max-h-[88vh] max-w-[94vw] w-auto h-auto object-contain rounded-lg shadow-2xl transition-transform duration-200"
            />
          </div>

          {/* Bottom Controls & Gesture Hint (Exact Matching Contoh Gambar 1) */}
          <div className="absolute bottom-0 inset-x-0 z-50 flex flex-col items-center justify-center pb-4 sm:pb-6 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none gap-2">
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleChangeCover(activePhoto.url)}
                className="flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/15 px-3.5 py-1.5 text-[11px] font-medium text-[#E8C28A] backdrop-blur-md transition-all cursor-pointer active:scale-95 shadow-lg"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Jadikan Sampul</span>
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-white/50 tracking-wide select-none">
              Geser untuk pindah • Cubit untuk memperbesar
            </p>
          </div>
        </div>
      )}

      {/* Modal Ganti Sampul */}
      {isCoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  Pilih Foto Sampul Baru
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik salah satu foto untuk menjadikannya foto sampul album ini
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCoverModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 min-h-0 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {gallery.photos.map((p) => {
                  const isCurrentCover = gallery.coverUrl === p.url
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleChangeCover(p.url)}
                      className={`group relative rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        isCurrentCover
                          ? 'border-[#C9A26A] ring-2 ring-[#C9A26A]/40'
                          : 'border-slate-800 hover:border-slate-600 bg-slate-950'
                      }`}
                    >
                      <img
                        src={p.thumbnailUrl}
                        alt={p.filename}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (p.url && e.currentTarget.src !== p.url) {
                            e.currentTarget.src = p.url
                          }
                        }}
                        className="w-full aspect-square object-cover block transition-transform duration-300 group-hover:scale-105"
                      />
                      {isCurrentCover && (
                        <div className="absolute inset-0 bg-[#C9A26A]/30 flex flex-col items-center justify-center gap-1 z-10">
                          <div className="h-7 w-7 rounded-full bg-[#C9A26A] text-slate-950 flex items-center justify-center shadow-lg">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </div>
                          <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                            Sampul Aktif
                          </span>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/75 rounded px-1.5 py-0.5 z-10">
                        <p className="text-[9px] font-mono text-white truncate text-center">
                          {p.filename}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCoverModalOpen(false)}
                className="rounded-xl border border-slate-800 bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bikin PIN / Atur Siapa yang Melihat */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-[#C9A26A]">
                <KeyRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Atur Privasi & PIN
                </h3>
                <p className="text-xs text-slate-400">
                  Batasi akses siapa saja yang boleh membuka album ini
                </p>
              </div>
            </div>

            <form onSubmit={handleSetPin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Kode PIN Akses (4-6 digit angka):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="Kosongkan jika ingin album publik"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm font-mono tracking-widest text-center text-white focus:border-[#C9A26A] focus:outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  Jika diisi, teman & keluarga harus memasukkan PIN ini untuk
                  melihat foto. Kosongkan untuk akses terbuka tanpa PIN.
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] py-2.5 text-xs font-bold text-slate-950 shadow-md hover:brightness-110 transition-all cursor-pointer"
                >
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
