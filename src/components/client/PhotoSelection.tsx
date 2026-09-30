import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Check,
  Search,
  SlidersHorizontal,
  Moon,
  Sun,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  CheckCircle2,
  ChevronsLeftRight,
  Share2,
  Download,
} from 'lucide-react'
import {
  findGalleryBySlug,
  togglePhotoSelection,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'

export default function PhotoSelection() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [gallery, setGallery] = useState<GalleryData | null>(null)

  // Primary filter: 'semua' | 'highlight' | 'terpilih' | 'swipe'
  const [mainTab, setMainTab] = useState<'semua' | 'highlight' | 'terpilih' | 'swipe'>('semua')
  // Secondary category filter: 'semua' | 'group' | 'keluarga' | 'sendiri'
  const [subCategory, setSubCategory] = useState<'semua' | 'group' | 'keluarga' | 'sendiri'>('semua')

  // Search & Lightbox
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [clientNotes, setClientNotes] = useState('')
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
      if (!targetSlug) {
        targetSlug = 'wisuda-putra-22-agustus-2026'
      }

      const data = findGalleryBySlug(targetSlug)
      setGallery(data)
      if (data?.clientName) {
        document.title = `${data.clientName} — Pilih Foto Favorit`
      }
    } catch (err) {
      console.error('[PhotoSelection] Error loading gallery:', err)
    } finally {
      setIsLoading(false)
    }
  }, [slug, location.pathname])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const photos = Array.isArray(gallery?.photos) ? gallery.photos : []
  const selectedPhotoIds = Array.isArray(gallery?.selectedPhotoIds) ? gallery.selectedPhotoIds : []
  const selectedCount = selectedPhotoIds.length
  const maxPhotos = gallery?.maxPhotos || 60

  // Counts for subcategories
  const countGroup = photos.filter((p) => p && p.category === 'Group').length
  const countKeluarga = photos.filter((p) => p && p.category === 'Keluarga').length
  const countSendiri = photos.filter((p) => p && p.category === 'Sendiri').length
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
    if (mainTab === 'highlight' && !p.isHighlight) return false
    if (mainTab === 'terpilih' && !selectedPhotoIds.includes(p.id)) return false

    // Subcategory filter
    if (subCategory === 'group' && p.category !== 'Group') return false
    if (subCategory === 'keluarga' && p.category !== 'Keluarga') return false
    if (subCategory === 'sendiri' && p.category !== 'Sendiri') return false

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
  }

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

  const handleFinalSubmit = () => {
    if (!gallery) return
    setIsSubmitModalOpen(false)
    showToast('Pilihan foto berhasil disimpan!')

    const selectedFilenames = photos
      .filter((p) => p && selectedPhotoIds.includes(p.id))
      .map((p) => p.filename || 'Foto')
      .join(', ')

    const waMsg = `Halo Livesostory.co, saya ${gallery.clientName} telah selesai memilih ${selectedCount} foto favorit:
${selectedFilenames}

Catatan: ${clientNotes || 'Tidak ada catatan tambahan.'}

Terima kasih!`

    const cleanPhone = (gallery.whatsapp || '').replace(/\D/g, '')
    const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone
    if (targetPhone) {
      window.open(
        `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(waMsg)}`,
        '_blank'
      )
    }
  }

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (!activePhoto || filteredPhotos.length === 0) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivePhoto(null)
      } else if (e.key === 'ArrowLeft') {
        prevPhoto()
      } else if (e.key === 'ArrowRight') {
        nextPhoto()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePhoto, activePhotoIndex, filteredPhotos])

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
              const fallback = findGalleryBySlug('wisuda-putra-22-agustus-2026')
              if (fallback) setGallery(fallback)
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
                className={`mt-0.5 text-xs ${
                  isDarkMode ? 'text-slate-400' : 'text-stone-500'
                }`}
              >
                Pilih hingga{' '}
                <strong
                  className={`font-semibold ${
                    isDarkMode ? 'text-[#E8C28A]' : 'text-stone-800'
                  }`}
                >
                  {maxPhotos}
                </strong>{' '}
                foto
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

              {/* Tab 2: Highlight */}
              <button
                type="button"
                onClick={() => setMainTab('highlight')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'highlight'
                    ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md'
                    : isDarkMode
                    ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Highlight</span>
              </button>

              {/* Tab 3: Terpilih */}
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
              </button>

              {/* Tab 4: Swipe */}
              <button
                type="button"
                onClick={() => {
                  setMainTab('swipe')
                  if (filteredPhotos.length > 0) {
                    openLightbox(filteredPhotos[0], 0)
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'swipe'
                    ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md'
                    : isDarkMode
                    ? 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <ChevronsLeftRight className="h-3.5 w-3.5" />
                <span>Swipe</span>
              </button>
            </div>

            {/* Divider and Right Tools (Search, Filter, Moon/Sun) */}
            <div className="flex items-center gap-2">
              <div className={`h-4 w-px mx-1 ${isDarkMode ? 'bg-slate-800' : 'bg-stone-300'}`} />

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

          {/* Navigation Bar 2: Sub-Categories */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
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
              Semua <span className="text-[11px] opacity-75">{totalCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('group')}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                subCategory === 'group'
                  ? isDarkMode
                    ? 'border border-[#C9A26A] bg-[#C9A26A]/20 text-[#E8C28A] font-semibold'
                    : 'bg-[#F5EFE6] text-[#9C7844] border border-[#E5D7C5] font-semibold'
                  : isDarkMode
                  ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
                  : 'border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              Group <span className="text-[11px] opacity-75">{countGroup}</span>
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('keluarga')}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                subCategory === 'keluarga'
                  ? isDarkMode
                    ? 'border border-[#C9A26A] bg-[#C9A26A]/20 text-[#E8C28A] font-semibold'
                    : 'bg-[#F5EFE6] text-[#9C7844] border border-[#E5D7C5] font-semibold'
                  : isDarkMode
                  ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
                  : 'border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              Keluarga <span className="text-[11px] opacity-75">{countKeluarga}</span>
            </button>

            <button
              type="button"
              onClick={() => setSubCategory('sendiri')}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                subCategory === 'sendiri'
                  ? isDarkMode
                    ? 'border border-[#C9A26A] bg-[#C9A26A]/20 text-[#E8C28A] font-semibold'
                    : 'bg-[#F5EFE6] text-[#9C7844] border border-[#E5D7C5] font-semibold'
                  : isDarkMode
                  ? 'border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200'
                  : 'border border-stone-200/90 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              Sendiri <span className="text-[11px] opacity-75">{countSendiri}</span>
            </button>
          </div>
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
          <div className="flex flex-wrap gap-2.5 sm:gap-3 justify-start">
            {filteredPhotos.map((photo, index) => {
              if (!photo) return null
              const isSelected = selectedPhotoIds.includes(photo.id)
              const isLandscape = photo.aspect === 'landscape'

              return (
                <div
                  key={photo.id}
                  onClick={() => openLightbox(photo, index)}
                  className={`group relative overflow-hidden rounded-xl cursor-pointer transition-all ${
                    isLandscape
                      ? 'h-[175px] sm:h-[220px] md:h-[250px] aspect-[4/3] grow'
                      : 'h-[175px] sm:h-[220px] md:h-[250px] aspect-[3/4] grow'
                  } ${
                    isDarkMode
                      ? 'bg-slate-900 border border-slate-800/80'
                      : 'bg-stone-200'
                  } ${
                    isSelected
                      ? 'ring-3 ring-[#C9A26A] shadow-xl'
                      : 'hover:brightness-95'
                  }`}
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
                      } else if (!target.dataset.triedDirect && fileId) {
                        target.dataset.triedDirect = 'true'
                        target.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`
                      } else if (!target.dataset.triedLh3 && fileId) {
                        target.dataset.triedLh3 = 'true'
                        target.src = `https://lh3.googleusercontent.com/d/${fileId}`
                      } else if (photo.url && target.src !== photo.url) {
                        target.src = photo.url
                      }
                    }}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />

                  {/* Subtle dark overlay when touched/hovered */}
                  <div
                    className={`absolute inset-0 bg-black/25 transition-opacity duration-200 pointer-events-none ${
                      isSelected
                        ? 'opacity-30'
                        : 'opacity-0 group-hover:opacity-100 group-active:opacity-100'
                    }`}
                  />

                  {/* Selected Indicator Badge at Top-Right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-md pointer-events-none z-10">
                      <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[3]" />
                    </div>
                  )}

                  {/* Center Selection Button (Tampil saat disentuh / di-hover) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <button
                      type="button"
                      onClick={(e) => handleToggle(photo, e)}
                      className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-3.5 py-2 sm:px-4 sm:py-2 rounded-full font-bold text-xs tracking-wide transition-all duration-200 cursor-pointer shadow-2xl backdrop-blur-md active:scale-95 touch-manipulation ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#9C7844] to-[#C9A26A] text-slate-950 font-bold shadow-[#C9A26A]/40 scale-100 opacity-100 ring-2 ring-white/30'
                          : 'bg-black/65 hover:bg-black/85 text-white border border-white/30 opacity-0 group-hover:opacity-100 group-active:opacity-100 scale-90 group-hover:scale-100 group-active:scale-100'
                      }`}
                      title={isSelected ? 'Batalkan pilihan foto' : 'Pilih foto ini'}
                    >
                      <Check
                        className={`h-4 w-4 ${
                          isSelected ? 'stroke-[3]' : 'stroke-[2.5]'
                        }`}
                      />
                      <span>{isSelected ? 'Terpilih' : 'Pilih'}</span>
                    </button>
                  </div>

                  {/* Photo Code Overlay on Hover / Touch */}
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity bg-black/70 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-sm">
                    {photo.filename}
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-stone-500'}`}>
              Pilihan Foto:
            </span>
            <span className="text-sm font-bold">
              <strong className={isDarkMode ? 'text-[#E8C28A]' : 'text-[#9C7844]'}>{selectedCount}</strong> / {maxPhotos} Foto
            </span>
            {selectedCount >= maxPhotos && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Kuota Terpenuhi
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
              onClick={() => setIsSubmitModalOpen(true)}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 px-4 py-2 text-xs sm:text-sm font-bold text-slate-950 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Selesai Memilih</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Modal (Exact Matching Contoh Gambar 1) */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Top Left: Counter (e.g. 2 / 80) */}
            <div className="pointer-events-auto text-sm sm:text-base font-normal tracking-wide text-white/90">
              {activePhotoIndex + 1} / {filteredPhotos.length}
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
            onClick={prevPhoto}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
            title="Foto Sebelumnya"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={nextPhoto}
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
            <p className="text-[11px] sm:text-xs text-white/50 tracking-wide select-none">
              Geser untuk pindah • Cubit untuk memperbesar
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Send Selected Photos */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all ${
              isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-stone-200 bg-white text-stone-900'
            }`}
          >
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

            <div
              className={`rounded-2xl p-4 space-y-2 text-xs mb-4 border ${
                isDarkMode ? 'border-slate-800 bg-slate-950/60' : 'border-stone-200 bg-[#FAF8F5]'
              }`}
            >
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-stone-500'}>Klien:</span>
                <span className="font-semibold text-white">{gallery.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className={isDarkMode ? 'text-slate-400' : 'text-stone-500'}>Foto Terpilih:</span>
                <span className="font-bold text-[#E8C28A]">
                  {selectedCount} dari {maxPhotos} foto
                </span>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <label className={`block text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-stone-600'}`}>
                Catatan khusus (opsional):
              </label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Contoh: Mohon foto keluarga diperhalus warnanya..."
                rows={3}
                className={`w-full rounded-xl border p-3 text-xs focus:border-[#C9A26A] focus:outline-none ${
                  isDarkMode
                    ? 'border-slate-800 bg-slate-950 text-slate-200'
                    : 'border-stone-200 bg-[#FAF8F5] text-stone-800'
                }`}
              />
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold cursor-pointer ${
                  isDarkMode
                    ? 'border-slate-800 text-slate-300 hover:bg-slate-800'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 py-2.5 text-xs font-bold text-slate-950 shadow-md cursor-pointer"
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
