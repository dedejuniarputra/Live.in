import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  Download,
  Lock,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  LayoutGrid,
  Link as LinkIcon,
  QrCode,
  Share2,
  ArrowUp,
  FolderArchive,
  Folder,
  ExternalLink,
} from 'lucide-react'
import {
  findGalleryBySlug,
  fetchGalleryBySlug,
  incrementGalleryViewCount,
  getPhotoThumbnailUrl,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'
import { onAdminAuthStateChanged, auth } from '../../lib/firebase.ts'

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
      return cleanSlug ? findGalleryBySlug(cleanSlug) : null
    } catch {
      return null
    }
  })

  const [isFetching, setIsFetching] = useState(!gallery)
  const [showSplash, setShowSplash] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (gallery) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true)
      }, 700)
      const removeTimer = setTimeout(() => {
        setShowSplash(false)
      }, 1400)
      return () => {
        clearTimeout(fadeTimer)
        clearTimeout(removeTimer)
      }
    } else if (!isFetching && !gallery) {
      setIsFadingOut(true)
      setShowSplash(false)
    }
  }, [gallery, isFetching])

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Admin auth check - only admins see "Kembali ke Dashboard"
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      return Boolean(auth?.currentUser)
    } catch {
      return false
    }
  })

  useEffect(() => {
    const unsubscribe = onAdminAuthStateChanged((user) => {
      setIsAdmin(Boolean(user))
    })
    return () => unsubscribe()
  }, [])

  // Scroll to top button visibility listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Main Tab State: 'highlight' vs 'semua'
  const [mainTab, setMainTab] = useState<'highlight' | 'semua'>('semua')
  const [activeCategory, setActiveCategory] = useState<string>('semua')

  // QR Modal & Download Album Modal
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)

  // Album share is permanently styled in modern dark mode
  const isDarkMode = true

  // PIN Gate
  const [isPinLocked, setIsPinLocked] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [photoRatios, setPhotoRatios] = useState<Record<string, number>>({})

  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 4
    const w = window.innerWidth
    if (w < 640) return 2
    if (w < 1024) return 3
    if (w < 1536) return 4
    return 5
  })

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      const nextCols = w < 640 ? 2 : w < 1024 ? 3 : w < 1536 ? 4 : 5
      setColumnCount((prev) => (prev === nextCols ? prev : nextCols))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])


  useEffect(() => {
    let isCancelled = false

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
          document.title = `Live.IN | Album Kenangan - ${data.clientName}`
        } else {
          document.title = 'Live.IN | Album Kenangan'
        }
      }

      const localData = cleanSlug ? findGalleryBySlug(cleanSlug) : null

      if (localData) {
        applyGallery(localData)
      }

      if (cleanSlug) {
        fetchGalleryBySlug(cleanSlug)
          .then((remoteData) => {
            if (isCancelled) return
            if (remoteData) {
              applyGallery(remoteData)
            } else {
              setGallery(null)
            }
            setIsFetching(false)
          })
          .catch(() => {
            if (!isCancelled) setIsFetching(false)
          })
      } else {
        if (!localData) setGallery(null)
        setIsFetching(false)
      }
    } catch (e) {
      console.error('[AlbumShare] Error loading gallery:', e)
      if (!isCancelled) setIsFetching(false)
    }

    return () => {
      isCancelled = true
    }
  }, [slug, location.pathname])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const photos = Array.isArray(gallery?.photos) ? gallery.photos : []
  const selectedPhotoIds = Array.isArray(gallery?.selectedPhotoIds)
    ? gallery.selectedPhotoIds
    : []

  // Highlights are exclusively the photos chosen by client
  const highlightPhotos = photos.filter(
    (p) => p && selectedPhotoIds.includes(p.id)
  )

  // Preload batch foto di background (saat splash screen berjalan) agar foto langsung siap tampil
  useEffect(() => {
    if (!photos || photos.length === 0) return

    const firstBatch = photos.slice(0, 24)
    firstBatch.forEach((p) => {
      const src = getPhotoThumbnailUrl(p, 600)
      if (src) {
        const img = new Image()
        img.src = src
      }
    })

    const timer = setTimeout(() => {
      const nextBatch = photos.slice(24, 72)
      nextBatch.forEach((p) => {
        const src = getPhotoThumbnailUrl(p, 600)
        if (src) {
          const img = new Image()
          img.src = src
        }
      })
    }, 400)

    return () => clearTimeout(timer)
  }, [photos])

  // Extract unique available categories dynamically for 'Semua Foto'
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

  // Currently displayed photos based on tab
  const displayedPhotos = mainTab === 'highlight' ? highlightPhotos : filteredPhotos

  const highlightColumns = useMemo(() => {
    const cols: { photo: GalleryPhoto; originalIndex: number }[][] = Array.from(
      { length: columnCount },
      () => []
    )
    highlightPhotos.forEach((photo, idx) => {
      if (photo) {
        cols[idx % columnCount].push({ photo, originalIndex: idx })
      }
    })
    return cols
  }, [highlightPhotos, columnCount])

  const allPhotosColumns = useMemo(() => {
    const cols: { photo: GalleryPhoto; originalIndex: number }[][] = Array.from(
      { length: columnCount },
      () => []
    )
    filteredPhotos.forEach((photo, idx) => {
      if (photo) {
        cols[idx % columnCount].push({ photo, originalIndex: idx })
      }
    })
    return cols
  }, [filteredPhotos, columnCount])

  const handlePrevPhoto = () => {
    if (displayedPhotos.length === 0) return
    const prev = (activePhotoIndex - 1 + displayedPhotos.length) % displayedPhotos.length
    setActivePhotoIndex(prev)
    setActivePhoto(displayedPhotos[prev])
  }

  const handleNextPhoto = () => {
    if (displayedPhotos.length === 0) return
    const next = (activePhotoIndex + 1) % displayedPhotos.length
    setActivePhotoIndex(next)
    setActivePhoto(displayedPhotos[next])
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
  }, [activePhoto, activePhotoIndex, gallery, displayedPhotos])

  // Touch gesture handlers for mobile Lightbox
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

  const handleDownloadAlbum = () => {
    setIsDownloadModalOpen(true)
  }

  const handleOpenDriveCategory = (catName?: string) => {
    setIsDownloadModalOpen(false)
    const targetUrl =
      gallery?.driveLink ||
      (photos[0]?.fileId ? `https://drive.google.com/drive/folders/${gallery?.id}` : '')

    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
      if (catName) {
        showToast(`Membuka folder "${catName}" di Google Drive...`)
      } else {
        showToast('Membuka seluruh album di Google Drive...')
      }
    } else {
      showToast('Tautan Google Drive belum disiapkan.')
    }
  }


  const effectiveSlug =
    slug ||
    (typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean).pop() || ''
      : '')

  const cleanSlugToTitle = (rawSlug?: string): string => {
    if (!rawSlug) return 'Album Kenangan'
    try {
      let s = decodeURIComponent(rawSlug).trim()
      s = s.split('?')[0].split('#')[0]
      const parts = s.split('/').filter(Boolean)
      if (parts.length > 0) {
        s = parts[parts.length - 1]
      }
      s = s.replace(/^(album|livesotory-co)[-_]/i, '')
      s = s.replace(/-3$/i, '')
      // Hapus suffix 4 digit random timestamp jika didahului tahun 4 digit (misal: 2026-4201 -> 2026)
      s = s.replace(/(\b(?:19|20)\d{2})[-_]\d{4,6}$/i, '$1')
      // Hapus suffix 4-6 digit random timestamp jika bukan tahun kalender (misal: budi-4201 -> budi)
      s = s.replace(/[-_](?!(?:19|20)\d{2})\d{4,6}$/i, '')
      s = s.replace(/[-_]+/g, ' ').trim()
      if (!s) return 'Album Kenangan'
      return s
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } catch {
      return 'Album Kenangan'
    }
  }

  const albumName =
    gallery?.clientName?.trim() || cleanSlugToTitle(effectiveSlug)

  const renderSplashScreen = (fadingOut = false) => (
    <div
      key="splash-screen-overlay"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#09090b] text-white transition-opacity duration-700 select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="flex flex-col items-center text-center px-6 max-w-sm mx-auto">
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-semibold tracking-[0.25em] text-stone-500 uppercase">
            PHOTO BY
          </span>
          <h2 className="text-sm sm:text-base font-extrabold tracking-[0.2em] text-stone-100 uppercase mt-1">
            LIVESOSTORY.CO
          </h2>
          <p className="text-xs text-stone-400 tracking-wide mt-2.5">
            album by <span className="text-[#C9A26A] font-medium">{albumName}</span>
          </p>
        </div>

        <div className="my-7">
          <div className="h-8 w-8 rounded-full border-2 border-stone-800 border-t-[#C9A26A] animate-spin" />
        </div>

        <p className="text-xs sm:text-[13px] text-stone-400 tracking-wide">
          Memuat foto...
        </p>
      </div>
    </div>
  )

  if (!gallery) {
    if (isFetching) {
      return (
        <div
          key="album-share-root"
          style={{ fontFamily: "'Inter', sans-serif" }}
          className="min-h-screen bg-[#09090b] text-slate-100 selection:bg-[#9C7844] selection:text-white"
        >
          {renderSplashScreen(false)}
        </div>
      )
    }

    return (
      <div
        key="album-share-root"
        style={{ fontFamily: "'Inter', sans-serif" }}
        className="min-h-screen bg-[#09090b] text-slate-100 selection:bg-[#9C7844] selection:text-white"
      >
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16] text-white p-6 text-center select-none">
          <h1 className="text-base sm:text-lg font-semibold text-white tracking-wide">Album Tidak Ditemukan</h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-2 max-w-sm leading-relaxed">
            Tautan album {effectiveSlug ? `"${cleanSlugToTitle(effectiveSlug)}"` : ''} sudah tidak tersedia atau telah dihapus.
          </p>
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
      <div
        key="album-share-root"
        style={{ fontFamily: "'Inter', sans-serif" }}
        className="min-h-screen bg-[#09090b] text-slate-100 selection:bg-[#9C7844] selection:text-white"
      >
        {showSplash && renderSplashScreen(isFadingOut)}
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
      </div>
    )
  }

  const firstSelectedPhoto =
    selectedPhotoIds.length > 0
      ? photos.find((p) => p && String(p.id) === String(selectedPhotoIds[0])) || highlightPhotos[0]
      : null

  const coverPhotoUrl =
    firstSelectedPhoto?.url ||
    gallery.coverUrl ||
    (Array.isArray(gallery.photos) && gallery.photos[0]?.url) ||
    ''

  return (
    <div
      key="album-share-root"
      style={{ fontFamily: "'Inter', sans-serif" }}
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? 'bg-[#09090b] text-slate-100 selection:bg-[#9C7844] selection:text-white'
          : 'bg-[#FAF8F5] text-stone-900 selection:bg-[#9C7844] selection:text-white'
      }`}
    >
      {showSplash && renderSplashScreen(isFadingOut)}
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-stone-900/95 border border-stone-700 px-5 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-xl animate-in fade-in">
          <Sparkles className="h-4 w-4 text-[#C9A26A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Admin Only: Floating Button Kembali ke Dashboard (Bottom Center - Sesuai Gambar 1) */}
      {isAdmin && (
        <Link
          to="/admin"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-white/20 bg-[#18181b]/95 hover:bg-[#27272a] text-white px-5 py-2.5 text-xs font-medium shadow-2xl backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95 hover:border-[#C9A26A]/50 shadow-black/80"
          title="Kembali ke Dashboard Admin"
          aria-label="Kembali ke Dashboard Admin"
        >
          <ChevronLeft className="h-4 w-4" />
          <span style={{ fontFamily: "'Inter', sans-serif" }}>
            Kembali ke Dashboard
          </span>
        </Link>
      )}

      {/* 1. Full-Bleed Grand Hero Cover (Contoh Gambar 1 & 2 - Mobile Friendly) */}
      <section className="relative w-full h-[100dvh] min-h-[520px] flex flex-col justify-between items-center text-center overflow-hidden bg-black select-none">
        {/* Background Cover Image with Vignette Gradient */}
        {coverPhotoUrl && (
          <img
            src={coverPhotoUrl}
            alt={gallery.clientName}
            className="absolute inset-0 w-full h-full object-cover object-center brightness-90 transition-transform duration-1000 ease-out hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85 pointer-events-none" />

        {/* Top Header: PHOTO BY Livesostory.co (Contoh Gambar 2) */}
        <div className="pt-8 sm:pt-10 pt-[max(2rem,env(safe-area-inset-top))] flex flex-col items-center z-10 px-4">
          <span
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="text-[9.5px] sm:text-[10.5px] font-normal tracking-[0.3em] uppercase text-white/80"
          >
            PHOTO BY
          </span>
          <span
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="text-[16px] font-normal tracking-wide text-white mt-0.5 drop-shadow-md"
          >
            Livesostory.co
          </span>
        </div>

        {/* Bottom Hero: Album Name & Scroll Down Indicator (Contoh Gambar 2 & 4) */}
        <div className="pb-8 sm:pb-10 pb-[max(2rem,calc(1.5rem+env(safe-area-inset-bottom)))] flex flex-col items-center z-10 gap-1.5 px-4 max-w-2xl mx-auto">
          <h2
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="text-[13px] font-semibold tracking-[0.25em] uppercase text-white drop-shadow-md text-center truncate max-w-full"
          >
            {gallery.clientName}
          </h2>

          <button
            type="button"
            onClick={() => {
              document.getElementById('album-content')?.scrollIntoView({ behavior: 'smooth' })
            }}
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="flex flex-col items-center text-[10px] font-medium tracking-[0.22em] uppercase text-white/80 hover:text-white transition-colors cursor-pointer group mt-1.5 active:scale-95"
          >
            <span>ALBUM SELENGKAPNYA</span>
            <ChevronDown className="h-3.5 w-3.5 mt-1 animate-bounce text-white/80 group-hover:text-white" />
          </button>
        </div>
      </section>

      {/* 2. Main Content & Gallery Area */}
      <div id="album-content" className="w-full min-h-screen flex flex-col justify-between">
        {/* Sticky Sub-Header Navigation Bar (Contoh Gambar 3 & 5 - Mobile Optimized) */}
        {/* Sticky Sub-Header Navigation Bar (Responsif 2 Baris di Mobile: Subfolder Pindah ke Bawah) */}
        <header
          className={`sticky top-0 z-30 w-full border-b backdrop-blur-md py-2 sm:py-2.5 transition-colors px-3 sm:px-6 lg:px-10 ${
            isDarkMode
              ? 'bg-[#09090b]/95 border-white/5 text-white'
              : 'bg-white/95 border-stone-200 text-stone-900 shadow-xs'
          }`}
        >
          <div className="w-full max-w-[1800px] mx-auto flex flex-col gap-2">
            {/* Baris 1: Tab Utama (Highlight & Semua Foto) di Kiri + Tombol Aksi di Kanan */}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* Sisi Kiri: Tab Utama */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                {/* Highlight Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setMainTab('highlight')
                    setActiveCategory('semua')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                    mainTab === 'highlight'
                      ? 'bg-[#242220] border border-white/10 text-[#C9A26A] shadow-xs'
                      : 'text-[#C9A26A] hover:brightness-125 border border-transparent'
                  }`}
                >
                  <span>Highlight</span>
                  {highlightPhotos.length > 0 && (
                    <span
                      className={`text-[10px] font-mono font-medium ${
                        mainTab === 'highlight' ? 'text-[#9C7844]' : 'text-[#9C7844]/80'
                      }`}
                    >
                      {highlightPhotos.length}
                    </span>
                  )}
                </button>

                {/* Semua Foto Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setMainTab('semua')
                    setActiveCategory('semua')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${
                    mainTab === 'semua' && activeCategory === 'semua'
                      ? 'bg-[#242220] border border-white/10 text-[#C9A26A] shadow-xs'
                      : 'text-[#999999] hover:text-white border border-transparent'
                  }`}
                >
                  <span>Semua Foto</span>
                  <span
                    className={`text-[10px] font-mono font-medium ${
                      mainTab === 'semua' && activeCategory === 'semua'
                        ? 'text-[#9C7844]'
                        : 'text-[#666666]'
                    }`}
                  >
                    {photos.length}
                  </span>
                </button>
              </div>

              {/* Sisi Kanan: Tombol Aksi (Download, Salin Link, QR Code) */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadAlbum}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-[#C9A26A] hover:bg-[#242220] transition-colors cursor-pointer active:scale-90"
                  title="Download Album"
                  aria-label="Download Album"
                >
                  <Download className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href)
                    showToast('Link album berhasil disalin!')
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-[#C9A26A] hover:bg-[#242220] transition-colors cursor-pointer active:scale-90"
                  title="Salin Link"
                  aria-label="Salin Link"
                >
                  <LinkIcon className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-[#C9A26A] hover:bg-[#242220] transition-colors cursor-pointer active:scale-90"
                  title="QR Code"
                  aria-label="QR Code"
                >
                  <QrCode className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Baris 2: Subfolder / Kategori Chapter (Pindah ke Bawah, Penuh & Tampak Semua) */}
            {availableCategories.length > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pt-1.5 pb-0.5 border-t border-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 shrink-0 mr-1 hidden sm:inline">
                  Chapter:
                </span>

                {/* Subfolder 'Semua' */}
                <button
                  type="button"
                  onClick={() => {
                    setMainTab('semua')
                    setActiveCategory('semua')
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 ${
                    mainTab === 'semua' && activeCategory === 'semua'
                      ? 'bg-[#242220] border border-[#C9A26A]/50 text-[#E8C28A] font-semibold shadow-xs'
                      : 'border border-white/10 bg-[#141312]/70 text-stone-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span>Semua</span>
                  <span
                    className={`text-[10px] font-mono font-medium ${
                      mainTab === 'semua' && activeCategory === 'semua'
                        ? 'text-[#C9A26A]'
                        : 'text-stone-500'
                    }`}
                  >
                    {photos.length}
                  </span>
                </button>

                {/* Subfolder Dinamis (Sendiri, Keluarga, Group, dsb) */}
                {availableCategories.map((cat) => {
                  const count = photos.filter(
                    (p) => p && (p.category || '').trim() === cat
                  ).length
                  const isActive = mainTab === 'semua' && activeCategory === cat

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setMainTab('semua')
                        setActiveCategory(cat)
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 ${
                        isActive
                          ? 'bg-[#242220] border border-[#C9A26A]/50 text-[#E8C28A] font-semibold shadow-xs'
                          : 'border border-white/10 bg-[#141312]/70 text-stone-400 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[10px] font-mono font-medium ${
                          isActive ? 'text-[#C9A26A]' : 'text-stone-500'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </header>

        {/* Big Editorial Album Title: Nama Folder & Sub Folder (Cormorant Garamond) */}
        <div className="w-full text-center px-4 pt-4 sm:pt-7 pb-5 sm:pb-7">
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', 'Cormorant', Georgia, serif",
            }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-[84px] font-normal tracking-normal text-white max-w-6xl mx-auto leading-[1.05]"
          >
            {gallery.clientName}
          </h1>

          {/* Sub Folder (Font Cormorant Garamond 40px - Sesuai Referensi) */}
          {mainTab === 'semua' && activeCategory !== 'semua' && (
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', 'Cormorant', Georgia, serif",
              }}
              className="text-2xl sm:text-3xl md:text-[40px] font-normal tracking-normal text-white/90 max-w-4xl mx-auto leading-tight mt-1.5 sm:mt-2.5"
            >
              {activeCategory}
            </h2>
          )}
        </div>

        {/* Tab 1: Highlight Section */}
        {mainTab === 'highlight' && (
          <div className="w-full px-3 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">
            {highlightPhotos.length === 0 ? (
              /* Empty Highlight State (Exact Matching Contoh Gambar 3) */
              <div className="flex flex-col items-center justify-center py-12 sm:py-24 text-center max-w-md mx-auto px-4 animate-in fade-in">
                {/* Round Star Icon Container */}
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-400 mb-5 shadow-sm">
                  <Star className="h-5 w-5" />
                </div>

                {/* Belum Ada Highlight Heading */}
                <h2
                  className={`text-xl sm:text-2xl font-semibold mb-2.5 ${
                    isDarkMode ? 'text-white' : 'text-stone-900'
                  }`}
                >
                  Belum Ada Highlight
                </h2>

                {/* Subtitle Description */}
                <p
                  className={`text-xs sm:text-sm italic leading-relaxed mb-6 sm:mb-8 ${
                    isDarkMode ? 'text-slate-400' : 'text-stone-600'
                  }`}
                >
                  Highlight adalah kumpulan foto paling berkesan dari album ini — cerita singkat yang dilihat lebih dulu sebelum menjelajah semua foto.
                </p>

                {/* LIHAT SEMUA FOTO Action Button */}
                <button
                  type="button"
                  onClick={() => setMainTab('semua')}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-[#E8C28A] px-5 py-2.5 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer shadow-md active:scale-95"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>LIHAT SEMUA FOTO</span>
                </button>
              </div>
            ) : (
              /* Kolase Foto Highlight (Potrait & Landscape Bersatu Harmonis) */
              <div className="flex gap-2.5 sm:gap-3 lg:gap-3.5 items-start animate-in fade-in">
                {highlightColumns.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-2.5 sm:gap-3 lg:gap-3.5 min-w-0">
                    {col.map(({ photo, originalIndex }) => {
                      const ratio =
                        photoRatios[photo.id] ||
                        (photo.aspect === 'landscape' ? 3 / 2 : 3 / 4)
                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            setActivePhotoIndex(originalIndex)
                            setActivePhoto(photo)
                          }}
                          style={{ aspectRatio: `${ratio}` }}
                          className="group relative w-full overflow-hidden rounded-xs sm:rounded-sm bg-neutral-900 cursor-pointer transition-all duration-300 hover:shadow-2xl active:scale-[0.98]"
                        >
                          <img
                            src={getPhotoThumbnailUrl(photo, 600)}
                            alt={photo.filename}
                            loading="eager"
                            decoding="async"
                            // @ts-ignore
                            fetchPriority={originalIndex < 12 ? 'high' : 'auto'}
                            referrerPolicy="no-referrer"
                            onLoad={(e) => {
                              const img = e.currentTarget
                              if (img.naturalWidth && img.naturalHeight) {
                                const r = img.naturalWidth / img.naturalHeight
                                setPhotoRatios((prev) => {
                                  if (prev[photo.id] && Math.abs(prev[photo.id] - r) < 0.01) return prev
                                  return { ...prev, [photo.id]: r }
                                })
                              }
                            }}
                            onError={(e) => {
                              const fileId = photo.fileId || photo.id
                              const target = e.currentTarget
                              if (!target.dataset.triedLh3 && fileId) {
                                target.dataset.triedLh3 = 'true'
                                target.src = `https://lh3.googleusercontent.com/d/${fileId}`
                              } else if (photo.url && target.src !== photo.url) {
                                target.src = photo.url
                              }
                            }}
                            className="w-full h-full object-cover block transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="font-mono text-[10px] text-white bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs truncate max-w-[75%]">
                              {photo.filename}
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/20 text-white backdrop-blur-xs">
                              <Maximize2 className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Button Navigasi Selanjutnya: Semua Foto */}
            <div className="flex flex-col items-center justify-center mt-12 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMainTab('semua')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="group flex items-center gap-4 sm:gap-5 px-6 py-2.5 sm:px-7 sm:py-3 border border-[#C9A26A]/40 hover:border-[#C9A26A] bg-transparent hover:bg-black/60 transition-all duration-300 cursor-pointer active:scale-95 shadow-sm"
              >
                <span
                  style={{ fontFamily: "'Inter', sans-serif" }}
                  className="text-[8px] font-semibold tracking-[0.25em] text-[#C9A26A] uppercase leading-none"
                >
                  SELANJUTNYA
                </span>
                <span
                  style={{ fontFamily: "'Inter', sans-serif" }}
                  className="text-[13px] font-medium text-white group-hover:text-white transition-colors leading-none tracking-normal"
                >
                  Semua Foto
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#C9A26A] group-hover:translate-y-0.5 transition-transform shrink-0" />
              </button>
            </div>

          </div>
        )}

        {/* Tab 2: Semua Foto Section */}
        {mainTab === 'semua' && (
          <main className="w-full px-3 sm:px-6 lg:px-10 max-w-[1800px] mx-auto">

            {filteredPhotos.length === 0 ? (
              <div className="py-24 text-center">
                <p className="text-sm text-slate-500">Tidak ada foto pada kategori ini.</p>
              </div>
            ) : (
              /* Kolase Semua Foto (Potrait & Landscape Bersatu Harmonis) */
              <div className="flex gap-2.5 sm:gap-3 lg:gap-3.5 items-start animate-in fade-in">
                {allPhotosColumns.map((col, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-2.5 sm:gap-3 lg:gap-3.5 min-w-0">
                    {col.map(({ photo, originalIndex }) => {
                      const ratio =
                        photoRatios[photo.id] ||
                        (photo.aspect === 'landscape' ? 3 / 2 : 3 / 4)
                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            setActivePhotoIndex(originalIndex)
                            setActivePhoto(photo)
                          }}
                          style={{ aspectRatio: `${ratio}` }}
                          className="group relative w-full overflow-hidden rounded-xs sm:rounded-sm bg-neutral-900 cursor-pointer transition-all duration-300 hover:shadow-2xl active:scale-[0.98]"
                        >
                          <img
                            src={getPhotoThumbnailUrl(photo, 600)}
                            alt={photo.filename}
                            loading="eager"
                            decoding="async"
                            // @ts-ignore
                            fetchPriority={originalIndex < 12 ? 'high' : 'auto'}
                            referrerPolicy="no-referrer"
                            onLoad={(e) => {
                              const img = e.currentTarget
                              if (img.naturalWidth && img.naturalHeight) {
                                const r = img.naturalWidth / img.naturalHeight
                                setPhotoRatios((prev) => {
                                  if (prev[photo.id] && Math.abs(prev[photo.id] - r) < 0.01) return prev
                                  return { ...prev, [photo.id]: r }
                                })
                              }
                            }}
                            onError={(e) => {
                              const fileId = photo.fileId || photo.id
                              const target = e.currentTarget
                              if (!target.dataset.triedLh3 && fileId) {
                                target.dataset.triedLh3 = 'true'
                                target.src = `https://lh3.googleusercontent.com/d/${fileId}`
                              } else if (photo.url && target.src !== photo.url) {
                                target.src = photo.url
                              }
                            }}
                            className="w-full h-full object-cover block transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <span className="font-mono text-[10px] text-white bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs truncate max-w-[75%]">
                              {photo.filename}
                            </span>
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/20 text-white backdrop-blur-xs">
                              <Maximize2 className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

          </main>
        )}

        {/* 3. Full-Width Footer Brand (Sesuai Referensi Gambar Footer) */}
        <footer
          style={{ fontFamily: "'Inter', sans-serif" }}
          className="w-full border-t border-white/10 mt-auto pt-7 sm:pt-9 pb-8 sm:pb-10 text-center select-none"
        >
          <p className="text-[10px] font-normal tracking-[0.25em] text-[#888888] uppercase leading-relaxed">
            PHOTO BY{' '}
            <strong className="font-bold text-white tracking-[0.25em]">
              LIVESOSTORY.CO
            </strong>
          </p>
        </footer>
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 right-3 sm:right-6 z-40 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer animate-in fade-in zoom-in-90 duration-200 ${
            isDarkMode
              ? 'border-white/15 bg-black/85 hover:bg-black text-white hover:text-[#C9A26A] hover:border-[#C9A26A]/50 shadow-black/80'
              : 'border-stone-300 bg-white/95 hover:bg-white text-stone-800 hover:text-[#9C7844] hover:border-[#C9A26A]/50 shadow-stone-400/40'
          }`}
          title="Kembali ke atas"
          aria-label="Kembali ke atas"
        >
          <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      )}

      {/* 4. Download Album Modal (Sesuai Desain Studio Warm Brown) */}
      {isDownloadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setIsDownloadModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#C9A26A]/25 bg-[#141312] text-white animate-in zoom-in-95 duration-200 select-none shadow-black/90"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Header: Title, Description & Close Button */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Download Album
                </h3>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  Foto tetap di Google Drive kamu. Live.IN hanya mengarahkan ke foldernya.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="h-8 w-8 rounded-full bg-[#242220] hover:bg-[#2d2a27] border border-stone-800 hover:border-[#C9A26A]/40 flex items-center justify-center text-stone-400 hover:text-white transition-all cursor-pointer shrink-0 active:scale-95"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tombol Seluruh Album */}
            <button
              type="button"
              onClick={() => handleOpenDriveCategory()}
              className="w-full flex items-center justify-between rounded-2xl border border-[#C9A26A]/40 bg-[#242220] hover:bg-[#2e2a27] hover:border-[#C9A26A] p-3.5 text-white transition-all cursor-pointer active:scale-[0.98] group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#141312] border border-[#C9A26A]/35 flex items-center justify-center text-[#C9A26A] shrink-0 group-hover:border-[#C9A26A] transition-colors">
                  <FolderArchive className="h-4.5 w-4.5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-semibold tracking-wide text-white group-hover:text-[#C9A26A] transition-colors">
                    Seluruh Album
                  </span>
                  <span className="block text-[11px] text-stone-400 font-normal">
                    Buka folder utama Google Drive
                  </span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-stone-500 group-hover:text-[#C9A26A] transition-colors shrink-0 mr-1" />
            </button>

            {/* Label PER CHAPTER dengan Garis Pembagi */}
            <div className="flex items-center gap-2.5 mt-6 mb-3">
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#C9A26A] uppercase shrink-0">
                PER CHAPTER
              </span>
              <div className="h-px flex-1 bg-stone-800/80" />
            </div>

            {/* List Chapter Folders */}
            <div className="space-y-2">
              {(availableCategories.length > 0
                ? availableCategories
                : ['Couple', 'Dekor', 'Group', 'Moment']
              ).map((chapter) => {
                const chapterCount = photos.filter(
                  (p) => p && (p.category || '').trim() === chapter
                ).length

                return (
                  <button
                    key={chapter}
                    type="button"
                    onClick={() => handleOpenDriveCategory(chapter)}
                    className="w-full flex items-center justify-between rounded-xl border border-stone-800 bg-[#191817] hover:bg-[#242220] hover:border-[#C9A26A]/40 px-3.5 py-3 text-white transition-all cursor-pointer active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-[#242220] border border-stone-800 flex items-center justify-center text-[#C9A26A] shrink-0 group-hover:border-[#C9A26A]/40 transition-colors">
                        <Folder className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-stone-200 group-hover:text-white truncate">
                        {chapter}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {chapterCount > 0 && (
                        <span className="text-[11px] font-mono font-medium text-stone-500 group-hover:text-stone-400">
                          {chapterCount} foto
                        </span>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-stone-600 group-hover:text-[#C9A26A] transition-colors" />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Tombol Batal */}
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(false)}
              className="w-full mt-5 rounded-xl border border-stone-800 hover:border-stone-700 bg-[#191817] hover:bg-[#242220] py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-stone-400 hover:text-white transition-all cursor-pointer active:scale-[0.98]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* 5. QR Code Modal */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:p-7 shadow-2xl border text-center transition-all ${
              isDarkMode
                ? 'border-slate-800 bg-[#0c121e] text-slate-100 shadow-black/90'
                : 'border-stone-200 bg-white text-stone-900 shadow-stone-400/50'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#C9A26A]" />
                <h3 className="text-sm font-bold">QR Code Album</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="rounded-xl p-1 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-2xl shadow-inner my-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  window.location.href
                )}`}
                alt="QR Code Album"
                className="h-48 w-48 object-contain"
              />
            </div>

            <p className="text-xs text-slate-400 mt-3 mb-4">
              Pindai QR code ini menggunakan kamera HP untuk langsung membuka album foto kenangan.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href)
                  showToast('Link album berhasil disalin!')
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] py-2.5 text-xs font-bold text-slate-950 shadow-md hover:brightness-110 cursor-pointer"
              >
                Salin Link Album
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="rounded-xl border border-slate-800 py-2.5 px-4 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Lightbox Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Top Left: Counter */}
            <div className="pointer-events-auto text-sm sm:text-base font-normal tracking-wide text-white/90">
              {activePhotoIndex + 1} / {displayedPhotos.length || 1}
            </div>

            {/* Top Right: Share, Download, Close */}
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
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

          {/* Left Arrow (Compact & Non-Obtrusive on Mobile) */}
          <button
            type="button"
            onClick={handlePrevPhoto}
            className="absolute left-1.5 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 sm:bg-white/10 sm:hover:bg-white/25 active:scale-90 text-white transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-lg"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Right Arrow (Compact & Non-Obtrusive on Mobile) */}
          <button
            type="button"
            onClick={handleNextPhoto}
            className="absolute right-1.5 sm:right-6 top-1/2 -translate-y-1/2 z-50 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 sm:bg-white/10 sm:hover:bg-white/25 active:scale-90 text-white transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-lg"
            title="Foto Selanjutnya"
          >
            <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Center Main Photo Container */}
          <div
            className="relative flex h-full w-full items-center justify-center p-2 sm:p-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={activePhoto.url || (activePhoto.fileId ? `https://drive.google.com/thumbnail?id=${activePhoto.fileId}&sz=w1600` : activePhoto.thumbnailUrl || '')}
              alt={activePhoto.filename}
              referrerPolicy="no-referrer"
              onError={(e) => {
                const fileId = activePhoto.fileId || activePhoto.id
                const target = e.currentTarget
                if (!target.dataset.triedLh3 && fileId) {
                  target.dataset.triedLh3 = 'true'
                  target.src = `https://lh3.googleusercontent.com/d/${fileId}`
                } else if (activePhoto.thumbnailUrl && target.src !== activePhoto.thumbnailUrl) {
                  target.src = activePhoto.thumbnailUrl
                }
              }}
              className="max-h-[76dvh] sm:max-h-[88dvh] max-w-[96vw] sm:max-w-[94vw] w-auto h-auto object-contain rounded-lg shadow-2xl transition-transform duration-200"
            />
          </div>

          {/* Bottom Gesture Hint */}
          <div className="absolute bottom-0 inset-x-0 z-50 flex flex-col items-center justify-center pb-4 sm:pb-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none gap-2">
            <p className="text-[11px] sm:text-xs text-white/50 tracking-wide select-none">
              Geser untuk pindah • Cubit untuk memperbesar
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
