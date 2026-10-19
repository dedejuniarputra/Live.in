import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Check,
  Search,
  SlidersHorizontal,
  Moon,
  Sun,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  CheckCircle2,
  ChevronsLeftRight,
  Share2,
  Download,
  Grid2X2,
  Grid3X3,
  Columns2,
  Eye,
} from 'lucide-react'
import {
  findGalleryBySlug,
  fetchGalleryBySlug,
  togglePhotoSelection,
  saveOrUpdateGallery,
  getStoredGalleries,
  incrementGalleryViewCount,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'

export default function PhotoSelection() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [gallery, setGallery] = useState<GalleryData | null>(() => {
    try {
      let targetSlug = slug ? decodeURIComponent(slug).trim() : ''
      if (!targetSlug) {
        const segments = window.location.pathname.split('/').filter(Boolean)
        const last = segments[segments.length - 1]
        if (last && !last.startsWith('livesotory') && !last.startsWith('livesostory')) {
          targetSlug = decodeURIComponent(last).trim()
        }
      }
      return (
        (targetSlug ? findGalleryBySlug(targetSlug) : null) ||
        getStoredGalleries()[0] ||
        null
      )
    } catch {
      return null
    }
  })

  // Primary filter: 'semua' | 'terpilih'
  const [mainTab, setMainTab] = useState<'semua' | 'terpilih'>('semua')
  // Secondary category filter: 'semua' | string
  const [subCategory, setSubCategory] = useState<string>('semua')

  // Grid Density Size: 'normal' | 'large'
  const [gridSize, setGridSize] = useState<'normal' | 'large'>('normal')

  // Search & Lightbox
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [loadedPhotos, setLoadedPhotos] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)

  // Theme toggle: Default Dark Mode matching AlbumShare and LIVEin luxury theme (#090D16)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('client-gallery-theme')
    return saved !== 'light'
  })

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev
      localStorage.setItem('client-gallery-theme', next ? 'dark' : 'light')
      return next
    })
  }

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      // Decode and extract slug from route param or URL pathname
      let targetSlug = slug ? decodeURIComponent(slug).trim() : ''
      if (!targetSlug) {
        const segments = location.pathname.split('/').filter(Boolean)
        const last = segments[segments.length - 1]
        if (last && !last.startsWith('livesotory') && !last.startsWith('livesostory')) {
          targetSlug = decodeURIComponent(last).trim()
        }
      }

      const applyGallery = (data: GalleryData) => {
        const sessionKey = `livein_selection_view_${data.id}`
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

        if (data?.clientName) {
          document.title = `${data.clientName} — Pilih Foto Favorit`
        }
        setIsLoading(false)
      }

      const localData =
        (targetSlug ? findGalleryBySlug(targetSlug) : null) ||
        getStoredGalleries()[0] ||
        null

      if (localData) {
        applyGallery(localData)
      }

      if (targetSlug) {
        fetchGalleryBySlug(targetSlug).then((remoteData) => {
          if (remoteData) {
            applyGallery(remoteData)
          } else if (!localData) {
            setGallery(null)
            setIsLoading(false)
          }
        })
      } else if (!localData) {
        setIsLoading(false)
      }

      // Check ?tab=terpilih in URL
      const params = new URLSearchParams(location.search)
      if (params.get('tab') === 'terpilih') {
        setMainTab('terpilih')
      }
    } catch (err) {
      console.error('[PhotoSelection] Error loading gallery:', err)
    } finally {
      setIsLoading(false)
    }
  }, [slug, location.pathname, location.search])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const photos = Array.isArray(gallery?.photos) ? gallery.photos : []
  const selectedPhotoIds = Array.isArray(gallery?.selectedPhotoIds) ? gallery.selectedPhotoIds : []
  const selectedCount = selectedPhotoIds.length
  const maxPhotos = gallery?.maxPhotos || 60

  // Extract unique available categories dynamically
  const availableCategories = Array.from(
    new Set(
      photos
        .map((p) => (p && p.category ? String(p.category).trim() : ''))
        .filter((cat): cat is string => Boolean(cat && cat.length > 0))
    )
  )
  const totalCount = photos.length

  // Filtering photos
  const filteredPhotos = photos.filter((p) => {
    if (!p) return false
    const filename = p.filename || ''

    // Search query
    if (searchQuery.trim() && !filename.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }

    // Main tab filter
    if (mainTab === 'terpilih' && !selectedPhotoIds.includes(p.id)) return false

    // Subcategory filter (only if multiple categories actually exist)
    if (availableCategories.length > 1 && subCategory !== 'semua') {
      if ((p.category || '').trim() !== subCategory) return false
    }

    return true
  })

  const handleToggle = (photo: GalleryPhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!photo || !photo.id || !gallery) return
    const { updatedGallery, isSelected } = togglePhotoSelection(gallery.slug, photo.id)
    if (updatedGallery) {
      setGallery(updatedGallery)
      if (isSelected) {
        showToast(`Foto ${photo.filename || 'Foto'} dipilih (${updatedGallery.selectedPhotoIds.length}/${maxPhotos})`)
      } else {
        showToast(`Foto ${photo.filename || 'Foto'} batal dipilih`)
      }
    } else if (selectedCount >= maxPhotos) {
      showToast(`Maksimal ${maxPhotos} foto sudah tercapai! Batalkan foto lain terlebih dahulu.`)
    }
  }

  const openLightbox = (photo: GalleryPhoto, index: number) => {
    if (!photo) return
    setActivePhotoIndex(index >= 0 ? index : 0)
    setActivePhoto(photo)
    setIsCompareMode(false)
  }

  const closeLightbox = () => {
    setActivePhoto(null)
    setIsCompareMode(false)
  }

  const compareIndex = filteredPhotos.length > 0 ? (activePhotoIndex + 1) % filteredPhotos.length : 0
  const comparePhoto = filteredPhotos[compareIndex]

  const nextPhoto = () => {
    if (!filteredPhotos || filteredPhotos.length === 0) return
    const nextIdx = (activePhotoIndex + 1) % filteredPhotos.length
    setActivePhotoIndex(nextIdx)
    setActivePhoto(filteredPhotos[nextIdx])
  }

  const prevPhoto = () => {
    if (!filteredPhotos || filteredPhotos.length === 0) return
    const prevIdx = (activePhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length
    setActivePhotoIndex(prevIdx)
    setActivePhoto(filteredPhotos[prevIdx])
  }

  const handleCopyList = () => {
    if (!gallery) return
    const selectedPhotosList = photos.filter((p) => p && selectedPhotoIds.includes(p.id))
    const filenamesText = selectedPhotosList
      .map((p) => `${p.filename || `Foto-${p.id}`},`)
      .join('\n')

    const clientName = (gallery.clientName || '').trim() || 'Wisuda Putra 22 Agustus 2026'

    const fullMsg = `Hallo kak LIVESOSTORY.CO, berikut daftar foto yang saya pilih dari folder ${clientName}:

${filenamesText}

Terima kasih kak :)`

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullMsg)
    } else {
      const textArea = document.createElement('textarea')
      textArea.value = fullMsg
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }

    setIsCopied(true)
    showToast('Pesan & daftar foto berhasil disalin!')
    setTimeout(() => setIsCopied(false), 2500)
  }

  const handleOpenWhatsApp = () => {
    if (!gallery) return
    showToast('Membuka WhatsApp...')

    const selectedPhotosList = photos.filter((p) => p && selectedPhotoIds.includes(p.id))
    const filenamesText = selectedPhotosList
      .map((p) => `${p.filename || `Foto-${p.id}`},`)
      .join('\n')

    const clientName = (gallery.clientName || '').trim() || 'Wisuda Putra 22 Agustus 2026'

    const waMsg = `Hallo kak LIVESOSTORY.CO, berikut daftar foto yang saya pilih dari folder ${clientName}:

${filenamesText}

Terima kasih kak :)`

    const rawPhone = import.meta.env.VITE_ADMIN_WHATSAPP || gallery.whatsapp || '628123456789'
    const cleanPhone = String(rawPhone).replace(/\D/g, '')
    const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone || '628123456789'
    window.open(
      `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(waMsg)}`,
      '_blank'
    )
  }

  // Keyboard navigation & shortcuts for Lightbox
  useEffect(() => {
    if (filteredPhotos.length === 0) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if client is typing inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'Escape') {
        if (isSubmitModalOpen) {
          setIsSubmitModalOpen(false)
          return
        }
        if (isCompareMode) {
          setIsCompareMode(false)
        } else if (activePhoto) {
          closeLightbox()
        }
      } else if (activePhoto) {
        if (e.key === 'ArrowLeft') {
          prevPhoto()
        } else if (e.key === 'ArrowRight') {
          nextPhoto()
        } else if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault()
          handleToggle(activePhoto)
        } else if (e.key === 'c' || e.key === 'C') {
          if (filteredPhotos.length > 1) {
            setIsCompareMode((prev) => !prev)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePhoto, activePhotoIndex, filteredPhotos, isCompareMode, isSubmitModalOpen])

  // Mobile Touch Gestures for Lightbox
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
      nextPhoto()
    } else if (distance < -minSwipeDistance) {
      prevPhoto()
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
          text: `Lihat foto ${photo.filename} dari ${gallery?.clientName}:`,
          url: shareUrl,
        })
        return
      } catch {
        // Fallback
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16] text-white p-6 text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#C9A26A] border-t-transparent mb-3 mx-auto" />
        <h2 className="text-base font-bold text-white">Memuat Galeri Foto...</h2>
        <p className="text-xs text-slate-400 mt-1">Menyiapkan foto-foto terbaik Anda</p>
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16] text-white p-6 text-center">
        <h2 className="text-lg font-bold text-white">Galeri Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Galeri untuk link &ldquo;{slug}&rdquo; tidak ditemukan.
        </p>
        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={() => {
              const latest = getStoredGalleries()[0] || null
              if (latest) setGallery(latest)
            }}
            className="rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 px-4 py-2 text-xs font-bold text-slate-950 transition-all cursor-pointer"
          >
            Buka Galeri Terbaru
          </button>
          <Link
            to="/login"
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition-colors"
          >
            Masuk ke Portal
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 pb-28 ${
        isDarkMode ? 'bg-[#090D16] text-slate-100 selection:bg-[#9C7844] selection:text-white' : 'bg-[#FAF8F5] text-stone-900'
      }`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-stone-900/90 text-white border border-stone-700/80 px-4 py-2 text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A26A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Section */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'border-slate-800/80 bg-[#090D16]/90'
            : 'border-stone-200/80 bg-[#FAF8F5]/90'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center justify-between">
            {/* Left: Branding & Client Title */}
            <div>
              <span className="block text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#C9A26A] uppercase">
                LIVESOSTORY.CO
              </span>
              <h1
                className={`mt-0.5 text-xl sm:text-2xl font-extrabold tracking-tight uppercase ${
                  isDarkMode ? 'text-white' : 'text-stone-900'
                }`}
              >
                {gallery.clientName}
              </h1>
              <p
                className={`mt-0.5 text-xs flex items-center gap-2 flex-wrap ${
                  isDarkMode ? 'text-slate-400' : 'text-stone-500'
                }`}
              >
                <span>
                  Pilih hingga{' '}
                  <strong
                    className={`font-semibold ${
                      isDarkMode ? 'text-[#E8C28A]' : 'text-stone-800'
                    }`}
                  >
                    {maxPhotos}
                  </strong>{' '}
                  foto
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-[#C9A26A]">
                  <Eye className="h-3 w-3" />
                  <span>Dibuka {gallery.viewCount || 1}x</span>
                </span>
              </p>
            </div>

            {/* Right: Pill Counter Badge */}
            <div
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold border shadow-xs ${
                isDarkMode
                  ? 'border-slate-800 bg-slate-900/90 text-slate-300'
                  : 'border-[#EBDAC3] bg-[#FAF3E8] text-stone-700'
              }`}
            >
              <span className="text-[#C9A26A] font-bold">{selectedCount}</span>
              <span className={isDarkMode ? 'text-slate-500' : 'text-stone-400'}>/</span>
              <span>{maxPhotos}</span>
            </div>
          </div>

          {/* Navigation Bar 1: Main Filter Tabs & Action Icons */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tab 1: Semua */}
              <button
                type="button"
                onClick={() => setMainTab('semua')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'semua'
                    ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md'
                    : isDarkMode
                    ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Semua</span>
              </button>

              {/* Tab 2: Terpilih */}
              <button
                type="button"
                onClick={() => setMainTab('terpilih')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'terpilih'
                    ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md'
                    : isDarkMode
                    ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Terpilih</span>
                {selectedCount > 0 && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      mainTab === 'terpilih'
                        ? 'bg-slate-950 text-[#C9A26A]'
                        : 'bg-[#C9A26A]/20 text-[#C9A26A]'
                    }`}
                  >
                    {selectedCount}
                  </span>
                )}
              </button>
            </div>

            {/* Right Tools (Mode Swipe, Grid Size Toggle, Search, Filter, Moon/Sun) */}
            <div className="flex items-center gap-2">
              {/* Dedicated Mode Swipe Button */}
              <button
                type="button"
                onClick={() => {
                  if (filteredPhotos.length > 0) {
                    openLightbox(filteredPhotos[0], 0)
                  } else {
                    showToast('Tidak ada foto untuk mode swipe')
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900/90 text-[#E8C28A] hover:bg-slate-800 hover:border-[#C9A26A]/50'
                    : 'border-stone-200 bg-white text-[#9C7844] hover:bg-stone-50'
                }`}
                title="Mode Swipe / Review Layar Penuh"
              >
                <ChevronsLeftRight className="h-3.5 w-3.5 text-[#C9A26A]" />
                <span className="hidden sm:inline">Mode Swipe</span>
              </button>

              <div className={`h-4 w-px mx-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-stone-300'}`} />

              {/* Grid Density Toggle */}
              <button
                type="button"
                onClick={() => setGridSize((prev) => (prev === 'normal' ? 'large' : 'normal'))}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title={gridSize === 'normal' ? 'Tampilan Grid Besar (Fokus Wajah)' : 'Tampilan Grid Standar'}
              >
                {gridSize === 'normal' ? <Grid2X2 className="h-3.5 w-3.5" /> : <Grid3X3 className="h-3.5 w-3.5" />}
              </button>

              {/* Search Toggle */}
              <button
                type="button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title="Cari foto"
              >
                <Search className="h-3.5 w-3.5" />
              </button>

              {/* Sort / Filter Button */}
              <button
                type="button"
                onClick={() => showToast('Urutkan berdasarkan nama/waktu')}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title="Filter & Urutkan"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>

              {/* Dark / Light Mode Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-amber-400 hover:bg-slate-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              >
                {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {/* Search Input Bar (when opened) */}
          {isSearchOpen && (
            <div className="mt-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ketik kode foto (contoh: DSC_0102)..."
                className={`w-full max-w-sm rounded-xl border px-3.5 py-1.5 text-xs focus:outline-none ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-900 text-white focus:border-[#C9A26A]'
                    : 'border-stone-200 bg-white text-stone-800 focus:border-[#9C7844]'
                }`}
                autoFocus
              />
            </div>
          )}

          {/* Navigation Bar 2: Sub-Categories (Hanya tampil jika Drive memiliki lebih dari 1 subfolder/kategori) */}
          {availableCategories.length > 1 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 animate-in fade-in">
              <button
                type="button"
                onClick={() => setSubCategory('semua')}
                className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  subCategory === 'semua'
                    ? isDarkMode
                      ? 'border border-[#C9A26A] bg-[#C9A26A]/20 text-[#E8C28A] font-semibold'
                      : 'bg-[#F5EFE6] text-[#9C7844] border border-[#E5D7C5] font-semibold'
                    : isDarkMode
                    ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
                    : 'border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                Semua <span className="text-[11px] opacity-75">({totalCount})</span>
              </button>

              {availableCategories.map((cat) => {
                const count = photos.filter((p) => p && (p.category || '').trim() === cat).length
                const isActive = subCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSubCategory(cat)}
                    className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? isDarkMode
                          ? 'border border-[#C9A26A] bg-[#C9A26A]/20 text-[#E8C28A] font-semibold'
                          : 'bg-[#F5EFE6] text-[#9C7844] border border-[#E5D7C5] font-semibold'
                        : isDarkMode
                        ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
                        : 'border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {cat} <span className="text-[11px] opacity-75">({count})</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Justified Photo Grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-5">
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center">
            <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-stone-500'}`}>
              Tidak ada foto pada kategori ini.
            </p>
          </div>
        ) : (
          <div
            className={`gap-3 sm:gap-4 ${
              gridSize === 'large'
                ? 'columns-1 sm:columns-2 md:columns-3 lg:columns-3 xl:columns-4'
                : 'columns-2 sm:columns-3 md:columns-4 lg:columns-4 xl:columns-5'
            }`}
          >
            {filteredPhotos.map((photo, index) => {
              if (!photo) return null
              const isSelected = selectedPhotoIds.includes(photo.id)
              const isLandscape = photo.aspect === 'landscape'
              const isLoaded = Boolean(loadedPhotos[photo.id])
              const initialSrc =
                photo.thumbnailUrl ||
                (photo.fileId
                  ? `https://drive.google.com/thumbnail?id=${photo.fileId}&sz=w800`
                  : photo.url)

              return (
                <div
                  key={photo.id}
                  onClick={() => openLightbox(photo, index)}
                  className={`group relative break-inside-avoid mb-3 sm:mb-4 overflow-hidden rounded-xl cursor-pointer transition-all ${
                    isLandscape ? 'aspect-[4/3]' : 'aspect-[3/4]'
                  } ${
                    isDarkMode
                      ? 'bg-slate-900 border border-slate-800/80'
                      : 'bg-stone-200 border border-stone-200/80'
                  } ${
                    isSelected
                      ? 'ring-3 ring-[#C9A26A] shadow-xl'
                      : 'hover:brightness-95'
                  }`}
                >
                  {/* Skeleton Placeholder (Prevents blank gaps and layout jumps) */}
                  {!isLoaded && (
                    <div
                      className={`absolute inset-0 animate-pulse ${
                        isDarkMode ? 'bg-slate-800/60' : 'bg-stone-300/60'
                      }`}
                    />
                  )}

                  <img
                    src={initialSrc}
                    alt={photo.filename}
                    loading={index < 12 ? 'eager' : 'lazy'}
                    decoding="async"
                    // @ts-ignore
                    fetchPriority={index < 6 ? 'high' : 'auto'}
                    referrerPolicy="no-referrer"
                    onLoad={() =>
                      setLoadedPhotos((prev) => (prev[photo.id] ? prev : { ...prev, [photo.id]: true }))
                    }
                    onError={(e) => {
                      setLoadedPhotos((prev) => (prev[photo.id] ? prev : { ...prev, [photo.id]: true }))
                      const fileId = photo.fileId || photo.id
                      const target = e.currentTarget
                      if (!target.dataset.triedProxy && fileId) {
                        target.dataset.triedProxy = 'true'
                        target.src = `/api/drive-image?id=${fileId}&sz=800`
                      } else if (!target.dataset.triedLh3 && fileId) {
                        target.dataset.triedLh3 = 'true'
                        target.src = `https://lh3.googleusercontent.com/d/${fileId}`
                      } else if (photo.url && target.src !== photo.url) {
                        target.src = photo.url
                      }
                    }}
                    className={`h-full w-full object-cover transition-opacity duration-300 group-hover:scale-[1.02] ${
                      isLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Subtle dark overlay when touched/hovered */}
                  <div
                    className={`absolute inset-0 bg-black/20 transition-opacity duration-200 pointer-events-none ${
                      isSelected
                        ? 'opacity-25'
                        : 'opacity-0 group-hover:opacity-100 group-active:opacity-100'
                    }`}
                  />

                  {/* Top-Right Circular Checkbox Button (Affordance always visible, faces never blocked) */}
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      type="button"
                      onClick={(e) => handleToggle(photo, e)}
                      className={`h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer shadow-md active:scale-90 ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 ring-2 ring-white/70 shadow-lg scale-100'
                          : 'border-2 border-white/75 bg-black/40 text-transparent hover:text-white/80 hover:border-white hover:bg-black/60 opacity-80 group-hover:opacity-100 hover:scale-105'
                      }`}
                      title={isSelected ? 'Batalkan pilihan foto' : 'Pilih foto ini'}
                    >
                      <Check className={`h-4 w-4 ${isSelected ? 'stroke-[3]' : 'stroke-[2.5]'}`} />
                    </button>
                  </div>

                  {/* Photo Code & Hint Overlay on Hover */}
                  <div className="pointer-events-none absolute bottom-0 inset-x-0 p-2 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                    <span className="font-mono text-[10px] text-white/90 truncate max-w-[70%] bg-black/50 px-1.5 py-0.5 rounded">
                      {photo.filename}
                    </span>
                    <span className="text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
                      Perbesar
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Bar (appears to confirm selection) */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 border-t py-3 px-4 sm:px-6 shadow-2xl backdrop-blur-md transition-all ${
          isDarkMode
            ? 'border-slate-800 bg-[#090D16]/95 text-white'
            : 'border-stone-200 bg-white/95 text-stone-900'
        }`}
      >
        {/* Visual Progress Bar along top edge */}
        <div className="absolute top-0 inset-x-0 h-1 bg-slate-800/60 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              selectedCount >= maxPhotos
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-[#9C7844] via-[#C9A26A] to-[#E8C28A]'
            }`}
            style={{ width: `${Math.min(100, (selectedCount / maxPhotos) * 100)}%` }}
          />
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-stone-500'}`}>
              Pilihan Foto:
            </span>
            <span className="text-sm font-bold">
              <strong className={isDarkMode ? 'text-[#E8C28A]' : 'text-[#9C7844]'}>{selectedCount}</strong> / {maxPhotos} Foto
            </span>

            {/* Dynamic Status Badges */}
            {selectedCount === 0 && (
              <span className="hidden sm:inline-flex text-xs text-slate-500">
                • Belum ada foto dipilih
              </span>
            )}
            {selectedCount > 0 && selectedCount < maxPhotos && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300/90">
                • Kurang {maxPhotos - selectedCount} foto lagi
              </span>
            )}
            {selectedCount === maxPhotos && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Kuota Terpenuhi
              </span>
            )}
            {selectedCount > maxPhotos && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                • Kelebihan {selectedCount - maxPhotos} foto
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to={`/${gallery.slug}-3?t=${gallery.shareToken}`}
              className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors hidden sm:block ${
                isDarkMode
                  ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              Lihat Album Kenangan
            </Link>

            <button
              type="button"
              disabled={selectedCount < maxPhotos}
              onClick={() => {
                if (selectedCount < maxPhotos) return
                setIsSubmitModalOpen(true)
                if (gallery && gallery.status !== 'Selesai dipilih') {
                  const updated = { ...gallery, status: 'Selesai dipilih' as const }
                  setGallery(updated)
                  saveOrUpdateGallery(updated)
                }
              }}
              title={
                selectedCount < maxPhotos
                  ? `Pilih ${maxPhotos - selectedCount} foto lagi untuk menyelesaikan`
                  : 'Selesai Memilih'
              }
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                selectedCount >= maxPhotos
                  ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 text-slate-950 shadow-lg shadow-[#C9A26A]/20 active:scale-95 cursor-pointer'
                  : isDarkMode
                  ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-60'
                  : 'bg-stone-200/80 text-stone-400 border border-stone-300/60 cursor-not-allowed opacity-60'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Selesai Memilih</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Top Left: Counter */}
            <div className="pointer-events-auto text-sm sm:text-base font-normal tracking-wide text-white/90">
              {activePhotoIndex + 1} / {filteredPhotos.length}
            </div>

            {/* Top Right: Compare, Share, Download, Close */}
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-3">
              {/* Compare Mode Toggle */}
              {filteredPhotos.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsCompareMode((prev) => !prev)}
                  className={`flex items-center gap-1.5 h-9 sm:h-10 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer backdrop-blur-md border shadow-lg ${
                    isCompareMode
                      ? 'bg-[#C9A26A] text-slate-950 border-[#C9A26A] font-bold ring-2 ring-white/50'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                  }`}
                  title="Bandingkan 2 Foto Berdampingan (Shortcut: Tekan C)"
                >
                  <Columns2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Bandingkan</span>
                </button>
              )}

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
                onClick={closeLightbox}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
                title="Tutup (Esc)"
              >
                <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Left Arrow */}
          <button
            type="button"
            onClick={prevPhoto}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
            title="Foto Sebelumnya (Panah Kiri)"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={nextPhoto}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
            title="Foto Selanjutnya (Panah Kanan)"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Center Main Photo Container (Supports Single View and Split Compare View) */}
          <div
            className="relative flex h-full w-full items-center justify-center p-3 sm:p-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isCompareMode && comparePhoto ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full w-full max-w-6xl items-center justify-center p-2 sm:p-4">
                {/* Photo A */}
                <div className="relative flex flex-col items-center justify-center h-full max-h-[75vh]">
                  <img
                    src={activePhoto.url || activePhoto.thumbnailUrl || (activePhoto.fileId ? `/api/drive-image?id=${activePhoto.fileId}&sz=1200` : '')}
                    alt={activePhoto.filename}
                    className="max-h-[60vh] sm:max-h-[66vh] w-auto max-w-full object-contain rounded-lg shadow-xl"
                  />
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded">
                      A: {activePhoto.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggle(activePhoto)}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition-all cursor-pointer shadow-md ${
                        selectedPhotoIds.includes(activePhoto.id)
                          ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{selectedPhotoIds.includes(activePhoto.id) ? 'Terpilih' : 'Pilih Foto A'}</span>
                    </button>
                  </div>
                </div>

                {/* Photo B */}
                <div className="relative flex flex-col items-center justify-center h-full max-h-[75vh]">
                  <img
                    src={comparePhoto.url || comparePhoto.thumbnailUrl || (comparePhoto.fileId ? `/api/drive-image?id=${comparePhoto.fileId}&sz=1200` : '')}
                    alt={comparePhoto.filename}
                    className="max-h-[60vh] sm:max-h-[66vh] w-auto max-w-full object-contain rounded-lg shadow-xl"
                  />
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] font-mono text-white/80 bg-black/60 px-2 py-0.5 rounded">
                      B: {comparePhoto.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggle(comparePhoto)}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition-all cursor-pointer shadow-md ${
                        selectedPhotoIds.includes(comparePhoto.id)
                          ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950'
                          : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{selectedPhotoIds.includes(comparePhoto.id) ? 'Terpilih' : 'Pilih Foto B'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>

          {/* Bottom Controls & Shortcut Hint */}
          <div className="absolute bottom-0 inset-x-0 z-50 flex flex-col items-center justify-center pb-4 sm:pb-6 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none gap-2">
            {!isCompareMode && (
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggle(activePhoto)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95 ${
                    selectedPhotoIds.includes(activePhoto.id)
                      ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 shadow-[#C9A26A]/20'
                      : 'bg-black/60 hover:bg-black/80 border border-white/20 text-white backdrop-blur-md'
                  }`}
                >
                  <Check
                    className={`h-4 w-4 ${
                      selectedPhotoIds.includes(activePhoto.id)
                        ? 'stroke-[3]'
                        : 'stroke-[2]'
                    }`}
                  />
                  <span>
                    {selectedPhotoIds.includes(activePhoto.id)
                      ? 'Sudah Terpilih'
                      : 'Pilih Foto Ini'}
                  </span>
                </button>
              </div>
            )}
            <p className="text-[11px] sm:text-xs text-white/60 tracking-wide select-none hidden sm:block">
              Tekan <kbd className="px-1.5 py-0.5 rounded bg-white/15 text-white font-mono text-[10px]">Spasi</kbd> untuk pilih • <kbd className="px-1.5 py-0.5 rounded bg-white/15 text-white font-mono text-[10px]">← / →</kbd> Pindah • <kbd className="px-1.5 py-0.5 rounded bg-white/15 text-white font-mono text-[10px]">C</kbd> Bandingkan • <kbd className="px-1.5 py-0.5 rounded bg-white/15 text-white font-mono text-[10px]">Esc</kbd> Tutup
            </p>
            <p className="text-[11px] text-white/50 tracking-wide select-none sm:hidden">
              Geser untuk pindah • Ketuk tombol untuk memilih
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Send Selected Photos */}
      {isSubmitModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setIsSubmitModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
              isDarkMode ? 'border-slate-800 bg-[#0c121e] text-slate-100' : 'border-stone-200 bg-white text-stone-900'
            }`}
          >
            {/* Header: Send Icon & Title */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9C7844]/15 text-[#C9A26A]">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Kirim Pilihan Foto</h3>
                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-stone-500'}`}>
                  Konfirmasi foto pilihan ke Livesostory.co
                </p>
              </div>
            </div>

            {/* Info Summary Card */}
            <div
              className={`rounded-2xl p-4 space-y-2 text-xs mb-3.5 border ${
                isDarkMode ? 'border-slate-800 bg-slate-950/60' : 'border-stone-200 bg-[#FAF8F5]'
              }`}
            >
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-stone-500'}>Klien:</span>
                <span className="font-semibold">{gallery.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-stone-500'}>Foto Terpilih:</span>
                <span className="font-bold text-[#E8C28A]">
                  {selectedCount} dari {maxPhotos} foto
                </span>
              </div>
            </div>

            {/* Green Notification Alert */}
            <div className="flex items-center gap-2 rounded-xl bg-[#0f2419] border border-[#1b4e31] px-3.5 py-2.5 text-xs font-medium text-[#4ade80] mb-3.5">
              <span className="font-bold">✓</span>
              <span>
                {selectedCount} foto tersimpan. Fotografermu sudah bisa melihatnya.
              </span>
            </div>

            {/* Scrollable Filename List */}
            <div className="space-y-1.5 mb-5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-stone-600'}`}>
                  Daftar foto terpilih ({selectedCount}):
                </span>
                <button
                  type="button"
                  onClick={handleCopyList}
                  className="text-[11px] text-[#C9A26A] hover:text-[#E8C28A] cursor-pointer font-semibold flex items-center gap-1 transition-colors"
                  title="Salin pesan & daftar foto"
                >
                  <span>📋</span>
                  <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={5}
                value={photos
                  .filter((p) => p && selectedPhotoIds.includes(p.id))
                  .map((p) => p.filename || `Foto-${p.id}`)
                  .join('\n')}
                className={`w-full rounded-xl border p-3 text-xs font-mono focus:outline-none resize-none leading-relaxed select-all ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-950/80 text-slate-200'
                    : 'border-stone-200 bg-[#FAF8F5] text-stone-800'
                }`}
                title="Daftar nama file foto terpilih"
              />
            </div>

            {/* Action Buttons: Batal & Kirim via WhatsApp */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 active:scale-[0.99] py-2.5 text-xs font-bold text-slate-950 shadow-md cursor-pointer transition-all"
              >
                Kirim via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
