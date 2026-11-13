import { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Check,
  CheckCircle2,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Send,
  Sparkles,
  ChevronsLeftRight,
  Share2,
  Download,
  Columns2,
  ArrowUp,
  Search,
} from 'lucide-react'
import {
  findGalleryBySlug,
  fetchGalleryBySlug,
  saveOrUpdateGallery,
  incrementGalleryViewCount,
  getPhotoThumbnailUrl,
  handlePhotoImgError,
  preloadInitialGalleryPhotos,
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
      return targetSlug ? findGalleryBySlug(targetSlug) : null
    } catch {
      return null
    }
  })

  // Primary filter: 'semua' | 'highlight' | 'terpilih'
  const [mainTab, setMainTab] = useState<'semua' | 'highlight' | 'terpilih'>('semua')
  // Secondary category filter: 'semua' | string
  const [subCategory, setSubCategory] = useState<string>('semua')

  // Sorting
  const isSortAsc = true

  // Lightbox & Selection
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [submitModalTab, setSubmitModalTab] = useState<'photos' | 'summary'>('photos')
  const [isCopied, setIsCopied] = useState(false)
  const [photoRatios, setPhotoRatios] = useState<Record<string, number>>({})
  const [photoPrintSizes, setPhotoPrintSizes] = useState<Record<string, string>>(() => {
    try {
      const localSlug = slug ? decodeURIComponent(slug).trim() : ''
      const cached = localSlug ? localStorage.getItem(`livein_print_sizes_${localSlug}`) : null
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {}
    return gallery?.photoPrintSizes || {}
  })

  const availablePrintSizes: string[] =
    Array.isArray(gallery?.printSizes) && gallery.printSizes.length > 0
      ? gallery.printSizes
      : []

  const setPhotoPrintSize = (photoId: string, size: string) => {
    setPhotoPrintSizes((prev) => {
      const next = { ...prev }
      if (size) {
        next[photoId] = size
      } else {
        delete next[photoId]
      }
      if (gallery) {
        const updated: GalleryData = { ...gallery, photoPrintSizes: next }
        setGallery(updated)
        saveOrUpdateGallery(updated)
        try {
          const cacheKey = `livein_print_sizes_${gallery.id || gallery.slug}`
          localStorage.setItem(cacheKey, JSON.stringify(next))
          if (gallery.slug) {
            localStorage.setItem(`livein_print_sizes_${gallery.slug}`, JSON.stringify(next))
          }
        } catch {}
      }
      return next
    })
  }

  const [columnCount, setColumnCount] = useState(() => {
    if (typeof window === 'undefined') return 6
    const w = window.innerWidth
    if (w < 640) return 2
    if (w < 768) return 3
    if (w < 1024) return 4
    if (w < 1280) return 5
    if (w < 1536) return 6
    return 7
  })

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth
      const nextCols =
        w < 640 ? 2 : w < 768 ? 3 : w < 1024 ? 4 : w < 1280 ? 5 : w < 1536 ? 6 : 7
      setColumnCount((prev) => (prev === nextCols ? prev : nextCols))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Scroll to top button visibility listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Kunci scroll halaman belakang saat modal konfirmasi atau lightbox terbuka
  useEffect(() => {
    if (isSubmitModalOpen || Boolean(activePhoto)) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isSubmitModalOpen, activePhoto])

  // Client gallery is permanently styled in modern dark mode (#0c0d0e)
  const isDarkMode = true

  const [isFetching, setIsFetching] = useState(!gallery)
  const [showSplash, setShowSplash] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    let isCancelled = false

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
        setGallery(data)
        if (data?.clientName) {
          document.title = `Live.IN | Seleksi Foto - ${data.clientName}`
        } else {
          document.title = 'Live.IN | Seleksi Foto'
        }

        // Pulihkan & sinkronkan ukuran cetak foto dari Firestore / cache lokal
        let restoredSizes: Record<string, string> = { ...(data?.photoPrintSizes || {}) }
        try {
          const cacheKey = `livein_print_sizes_${data.id || data.slug}`
          const cacheSlugKey = data.slug ? `livein_print_sizes_${data.slug}` : ''
          const cached = localStorage.getItem(cacheKey) || (cacheSlugKey ? localStorage.getItem(cacheSlugKey) : null)
          if (cached) {
            const parsed = JSON.parse(cached)
            if (parsed && typeof parsed === 'object') {
              restoredSizes = { ...parsed, ...restoredSizes }
            }
          }
        } catch {}

        if (Object.keys(restoredSizes).length > 0) {
          setPhotoPrintSizes(restoredSizes)
        }

        const sessionKey = `livein_selection_view_${data.id}`
        if (!sessionStorage.getItem(sessionKey)) {
          const updated = incrementGalleryViewCount(data.slug || data.id)
          if (updated) {
            setGallery(updated)
            sessionStorage.setItem(sessionKey, '1')
          }
        }
      }

      const localData = targetSlug ? findGalleryBySlug(targetSlug) : null

      if (localData) {
        applyGallery(localData)
      }

      if (targetSlug) {
        fetchGalleryBySlug(targetSlug).then((remoteData) => {
          if (isCancelled) return
          if (remoteData) {
            applyGallery(remoteData)
          } else {
            setGallery(null)
          }
          setIsFetching(false)
        })
      } else {
        setIsFetching(false)
      }

      // Check ?tab=terpilih in URL
      const params = new URLSearchParams(location.search)
      if (params.get('tab') === 'terpilih') {
        setMainTab('terpilih')
      }
    } catch (err) {
      console.error('[PhotoSelection] Error loading gallery:', err)
      if (!isCancelled) setIsFetching(false)
    }

    return () => {
      isCancelled = true
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

  // Splash screen & Preload foto agar foto siap tampil sebelum klien melihat galeri
  useEffect(() => {
    if (!gallery || !photos || photos.length === 0) {
      if (!isFetching && !gallery) {
        setIsFadingOut(true)
        setShowSplash(false)
      }
      return
    }

    let isCancelled = false
    const startTime = Date.now()
    const MIN_SPLASH_TIME = 900 // Minimal durasi splash agar transisi visual terasa nyaman

    preloadInitialGalleryPhotos(photos, 16, 4000).then((res) => {
      if (isCancelled) return
      if (res.photoRatios && Object.keys(res.photoRatios).length > 0) {
        setPhotoRatios((prev) => ({ ...prev, ...res.photoRatios }))
      }

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, MIN_SPLASH_TIME - elapsed)

      setTimeout(() => {
        if (isCancelled) return
        setIsFadingOut(true)
        setTimeout(() => {
          if (isCancelled) return
          setShowSplash(false)
        }, 700)
      }, remaining)

      // Lanjutkan preload batch foto berikutnya (16 - 64) di background setelah viewport pertama siap
      setTimeout(() => {
        if (isCancelled) return
        photos.slice(16, 64).forEach((p) => {
          const src = getPhotoThumbnailUrl(p, 600)
          if (src) {
            const img = new Image()
            img.referrerPolicy = 'no-referrer'
            img.src = src
          }
        })
      }, remaining + 800)
    })

    return () => {
      isCancelled = true
    }
  }, [gallery?.id, isFetching])

  // Highlights are exclusively the photos chosen by the client
  const highlightPhotos = photos.filter(
    (p) => p && selectedPhotoIds.includes(p.id)
  )

  // Extract unique available categories (subfolders) dynamically
  const availableCategories = Array.from(
    new Set(
      photos
        .map((p) => (p && p.category ? String(p.category).trim() : ''))
        .filter((cat): cat is string => Boolean(cat && cat.length > 0))
    )
  )
  const totalCount = photos.length
  const mainFolderName = (gallery?.clientName || 'Folder').trim()
  const displayFolders = availableCategories.length > 0 ? availableCategories : [mainFolderName]

  // Filtering photos
  const filteredPhotos = photos
    .filter((p) => {
      if (!p) return false

      // Main tab filter
      if (mainTab === 'terpilih' && !selectedPhotoIds.includes(p.id)) return false
      if (mainTab === 'highlight' && !selectedPhotoIds.includes(p.id)) return false

      // Folder / category filter (Menyesuaikan dengan nama folder Google Drive)
      if (subCategory !== 'semua') {
        if (availableCategories.length > 0) {
          if ((p.category || '').trim() !== subCategory) return false
        } else {
          if (subCategory !== mainFolderName) return false
        }
      }


      return true
    })
    .sort((a, b) => {
      const nameA = a.filename || ''
      const nameB = b.filename || ''
      return isSortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    })

  const selectionColumns = useMemo(() => {
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

  const handleToggle = (photo: GalleryPhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!photo || !photo.id || !gallery) return

    const photoId = String(photo.id)
    const currentIds = Array.isArray(gallery.selectedPhotoIds)
      ? gallery.selectedPhotoIds.map(String)
      : []
    const isAlreadySelected = currentIds.includes(photoId)

    if (!isAlreadySelected && currentIds.length >= maxPhotos) {
      showToast(`Maksimal ${maxPhotos} foto sudah tercapai! Batalkan foto lain terlebih dahulu.`)
      return
    }

    const newSelectedIds = isAlreadySelected
      ? currentIds.filter((id) => id !== photoId)
      : [...currentIds, photoId]

    const nextPhotoPrintSizes = { ...photoPrintSizes }
    if (isAlreadySelected && nextPhotoPrintSizes[photoId]) {
      delete nextPhotoPrintSizes[photoId]
      setPhotoPrintSizes(nextPhotoPrintSizes)
      try {
        const cacheKey = `livein_print_sizes_${gallery.id || gallery.slug}`
        localStorage.setItem(cacheKey, JSON.stringify(nextPhotoPrintSizes))
        if (gallery.slug) {
          localStorage.setItem(`livein_print_sizes_${gallery.slug}`, JSON.stringify(nextPhotoPrintSizes))
        }
      } catch {}
    }

    const updatedPhotos = (gallery.photos || []).map((p) => ({
      ...p,
      isHighlight: newSelectedIds.includes(String(p.id)),
    }))

    const newStatus: 'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih' =
      newSelectedIds.length === 0
        ? 'Belum mulai'
        : newSelectedIds.length >= maxPhotos
        ? 'Selesai dipilih'
        : 'Sedang memilih'

    const firstChosenId = newSelectedIds[0]
    const firstChosenPhoto = firstChosenId
      ? (gallery.photos || []).find((p) => String(p.id) === String(firstChosenId))
      : null

    const updatedGallery: GalleryData = {
      ...gallery,
      coverUrl: firstChosenPhoto?.url || (gallery.photos && gallery.photos[0]?.url) || '',
      photos: updatedPhotos,
      selectedPhotoIds: newSelectedIds,
      selectedPhotos: newSelectedIds.length,
      status: newStatus,
      photoPrintSizes: isAlreadySelected ? nextPhotoPrintSizes : photoPrintSizes,
    }

    setGallery(updatedGallery)
    saveOrUpdateGallery(updatedGallery)

    if (!isAlreadySelected) {
      showToast(`Foto ${photo.filename || 'Foto'} dipilih (${newSelectedIds.length}/${maxPhotos})`)
    } else {
      showToast(`Foto ${photo.filename || 'Foto'} batal dipilih`)
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
    const hasPrintSizes = availablePrintSizes.length > 0
    const filenamesText = selectedPhotosList
      .map((p) => {
        const name = p.filename || `Foto-${p.id}`
        const size = hasPrintSizes ? photoPrintSizes[p.id] : undefined
        return size ? `${name} — cetak ${size},` : `${name},`
      })
      .join('\n')

    const clientName = (gallery.clientName || '').trim() || 'Wisuda Putra 22 Agustus 2026'

    const fullMsg = `Hallo kak Livesostory, berikut daftar foto yang sudah saya pilih dari folder ${clientName}:

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
    const hasPrintSizes = availablePrintSizes.length > 0
    const filenamesText = selectedPhotosList
      .map((p) => {
        const name = p.filename || `Foto-${p.id}`
        const size = hasPrintSizes ? photoPrintSizes[p.id] : undefined
        return size ? `${name} — cetak ${size},` : `${name},`
      })
      .join('\n')

    const clientName = (gallery.clientName || '').trim() || 'Wisuda Putra 22 Agustus 2026'

    const waMsg = `Hallo kak Livesostory, berikut daftar foto yang sudah saya pilih dari folder ${clientName}:

${filenamesText}

Terima kasih kak :)`

    const rawPhone = import.meta.env.VITE_ADMIN_WHATSAPP || '6289601350794'
    const cleanPhone = String(rawPhone).replace(/\D/g, '')
    const targetPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone || '6289601350794'

    // Simpan pilihan ukuran cetak dan tandai status galeri telah selesai dipilih
    const updatedGallery: GalleryData = {
      ...gallery,
      status: 'Selesai dipilih',
      photoPrintSizes: { ...photoPrintSizes },
    }
    setGallery(updatedGallery)
    saveOrUpdateGallery(updatedGallery)
    try {
      const cacheKey = `livein_print_sizes_${gallery.id || gallery.slug}`
      localStorage.setItem(cacheKey, JSON.stringify(photoPrintSizes))
      if (gallery.slug) {
        localStorage.setItem(`livein_print_sizes_${gallery.slug}`, JSON.stringify(photoPrintSizes))
      }
    } catch {}

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

  const effectiveSlug =
    slug ||
    (typeof window !== 'undefined'
      ? window.location.pathname.split('/').filter(Boolean).pop() || ''
      : '')

  const cleanSlugToTitle = (rawSlug?: string): string => {
    if (!rawSlug) return 'Galeri Foto'
    try {
      let s = decodeURIComponent(rawSlug).trim()
      s = s.split('?')[0].split('#')[0]
      const parts = s.split('/').filter(Boolean)
      if (parts.length > 0) {
        s = parts[parts.length - 1]
      }
      s = s.replace(/^(album|livesotory-co|livesostory-co|gallery|select|pilihin)[-_]/i, '')
      s = s.replace(/-3$/i, '')
      s = s.replace(/(\b(?:19|20)\d{2})[-_]\d{4,6}$/i, '$1')
      s = s.replace(/[-_](?!(?:19|20)\d{2})\d{4,6}$/i, '')
      s = s.replace(/[-_]+/g, ' ').trim()
      if (!s) return 'Galeri Foto'
      return s
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } catch {
      return 'Galeri Foto'
    }
  }

  const albumName =
    gallery?.clientName?.trim() || cleanSlugToTitle(effectiveSlug)

  const renderSplashScreen = (fadingOut = false) => (
    <div
      key="splash-screen-overlay"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b] text-white transition-opacity duration-700 select-none ${
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

        <p className="text-xs sm:text-[13px] text-stone-200 font-medium tracking-wide">
          Menyiapkan galeri foto...
        </p>
        <p className="text-[11px] text-stone-500 tracking-wide mt-1">
          Memastikan semua foto siap ditampilkan
        </p>
      </div>
    </div>
  )

  if (!gallery) {
    if (isFetching) {
      return (
        <div className="min-h-screen bg-[#09090b] text-white">
          {renderSplashScreen(false)}
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090D16] text-white p-6 text-center select-none">
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide">Galeri Tidak Ditemukan</h2>
        <p className="text-xs sm:text-sm text-stone-400 mt-2 max-w-sm leading-relaxed">
          Galeri {slug ? `"${decodeURIComponent(slug)}"` : ''} sudah tidak tersedia atau telah dihapus.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:pb-20 ${
        isDarkMode
          ? 'bg-[#0c0d0e] text-slate-100 selection:bg-[#ba965c] selection:text-white'
          : 'bg-[#FAF8F5] text-stone-900 selection:bg-[#ba965c] selection:text-white'
      }`}
    >
      {showSplash && renderSplashScreen(isFadingOut)}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-stone-900/90 text-white border border-stone-700/80 px-4 py-2 text-xs font-medium shadow-2xl backdrop-blur-md animate-in fade-in">
          <Sparkles className="h-3.5 w-3.5 text-[#C9A26A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Section (Contoh Gambar 1 & 2) */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'border-white/10 bg-[#0c0d0e]/95'
            : 'border-stone-200 bg-[#FAF8F5]/95'
        }`}
      >
        <div className="w-full px-2 sm:px-4 pt-3 pb-2">
          {/* Row 1: Brand, Title, and Counter Badge */}
          <div className="flex items-center justify-between gap-3">
            {/* Left: Branding & Client Title (All using Segoe UI font) */}
            <div
              style={{
                fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
              }}
              className="min-w-0 pr-2"
            >
              <span className="block text-[10.5px] sm:text-[11px] font-bold tracking-[0.18em] text-[#C9A26A] uppercase">
                LIVESOSTORY.CO
              </span>
              <h1
                className="mt-0.5 text-[17px] font-semibold text-white tracking-normal truncate leading-snug"
                title={gallery.clientName}
              >
                {gallery.clientName}
              </h1>
              <p className="mt-0.5 text-xs text-[#777777]">
                Pilih hingga{' '}
                <strong className="font-bold text-[#b8b8b8]">{maxPhotos}</strong>{' '}
                foto
              </p>
            </div>

            {/* Right: Counter Pill Badge (Contoh Gambar 1) */}
            <div
              style={{
                fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
              }}
              className="shrink-0 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-[#1a1a1c] border border-white/10 text-[#888888]"
            >
              <span className="text-[#C9A26A] font-bold">{selectedCount}</span>
              <span className="text-[#555555]">/</span>
              <span>{maxPhotos}</span>
            </div>
          </div>

          {/* Thin Gold Divider Line (Contoh Gambar 1) */}
          <div className="w-full border-b border-[#C9A26A]/30 mt-3" />

          {/* Navigation Bar 1: Main Filter Tabs & Action Icons (Contoh Gambar 1) */}
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto [scrollbar-width:none]">
              {/* Tab 1: Semua */}
              <button
                type="button"
                onClick={() => setMainTab('semua')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'semua'
                    ? 'bg-[#ba965c] text-white shadow-xs'
                    : 'border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white'
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
                    ? 'bg-[#ba965c] text-white shadow-xs'
                    : 'border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                <span>Highlight</span>
                {highlightPhotos.length > 0 && (
                  <span className="text-[10px] opacity-80">({highlightPhotos.length})</span>
                )}
              </button>

              {/* Tab 3: Terpilih */}
              <button
                type="button"
                onClick={() => setMainTab('terpilih')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  mainTab === 'terpilih'
                    ? 'bg-[#ba965c] text-white shadow-xs'
                    : 'border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>Terpilih ({selectedCount})</span>
              </button>

              {/* Tab 4: Swipe */}
              <button
                type="button"
                onClick={() => {
                  if (filteredPhotos.length > 0) {
                    openLightbox(filteredPhotos[0], 0)
                  } else {
                    showToast('Tidak ada foto untuk mode swipe')
                  }
                }}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white transition-all cursor-pointer"
                title="Mode Swipe / Review Layar Penuh"
              >
                <ChevronsLeftRight className="h-3.5 w-3.5" />
                <span>Swipe</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar 2: Folder Category Pills (Menyesuaikan nama folder saat Google Drive discan) */}
          <div
            style={{
              fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif",
            }}
            className="mt-2.5 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]"
          >
            <button
              type="button"
              onClick={() => setSubCategory('semua')}
              className={`rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                subCategory === 'semua'
                  ? 'border border-[#ba965c] bg-[#ba965c]/15 text-[#E8C28A] font-semibold'
                  : 'border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white'
              }`}
            >
              Semua <span className="text-[10px] opacity-75">{totalCount}</span>
            </button>

            {displayFolders.map((folder) => {
              const count =
                availableCategories.length > 0
                  ? photos.filter((p) => p && (p.category || '').trim() === folder).length
                  : totalCount
              const isActive = subCategory === folder

              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setSubCategory(subCategory === folder ? 'semua' : folder)}
                  className={`rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'border border-[#ba965c] bg-[#ba965c]/15 text-[#E8C28A] font-semibold'
                      : 'border border-white/15 bg-transparent text-[#9e9e9e] hover:text-white'
                  }`}
                >
                  {folder} <span className="text-[10px] opacity-75">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Photo Grid (Full-Width Edge-to-Edge with Larger Photos) */}
      <main className="w-full px-1 sm:px-2 pt-2 sm:pt-2.5 flex-1 flex flex-col justify-between">
        {filteredPhotos.length === 0 ? (
          <div className="py-20 text-center">
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-stone-500'}`}>
              {mainTab === 'highlight' || mainTab === 'terpilih'
                ? 'Belum ada foto yang dipilih. Silakan pilih foto favorit Anda pada tab "Semua".'
                : 'Tidak ada foto pada kategori ini.'}
            </p>
          </div>
        ) : (
          /* Kolase Foto Seleksi (Potrait & Landscape Bersatu Harmonis) */
          <div className="flex gap-1.5 sm:gap-2 items-start">
            {selectionColumns.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 flex flex-col gap-1.5 sm:gap-2 min-w-0">
                {col.map(({ photo, originalIndex }) => {
                  const isSelected = selectedPhotoIds.includes(photo.id)
                  const selectionIdx = selectedPhotoIds.indexOf(photo.id)
                  const initialSrc = getPhotoThumbnailUrl(photo)
                  const ratio =
                    photoRatios[photo.id] ||
                    (photo.aspect === 'landscape' ? 3 / 2 : 3 / 4)

                  return (
                    <div
                      key={photo.id}
                      onClick={() => handleToggle(photo)}
                      style={{ aspectRatio: `${ratio}` }}
                      className={`group relative w-full overflow-hidden rounded-lg sm:rounded-xl cursor-pointer transition-all select-none ${
                        isDarkMode
                          ? 'bg-slate-900'
                          : 'bg-stone-200'
                      } ${
                        isSelected
                          ? 'border-[2.5px] border-[#C9A26A] shadow-md'
                          : 'border-[2.5px] border-transparent hover:border-white/20 hover:brightness-95'
                      }`}
                    >
                      <img
                        src={initialSrc}
                        alt={photo.filename}
                        loading={originalIndex < 12 ? 'eager' : 'lazy'}
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
                        onError={(e) => handlePhotoImgError(e, photo, 800)}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      />

                      {/* Overlay Gelap Halus saat Terpilih atau saat Hover */}
                      <div
                        className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
                          isSelected
                            ? 'bg-black/20 opacity-100'
                            : 'bg-black/35 opacity-0 group-hover:opacity-100'
                        }`}
                      />

                      {/* Center Action Buttons: Zoom (kiri) & Select (kanan) */}
                      <div className="absolute inset-0 flex items-center justify-center gap-2 sm:gap-2.5 z-20 pointer-events-none">
                        {/* Zoom / Search Button (Kiri) - Muncul saat hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openLightbox(photo, originalIndex)
                          }}
                          className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 border-white bg-black/60 hover:bg-black/90 text-white flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 cursor-pointer opacity-0 group-hover:opacity-100 pointer-events-auto"
                          title="Perbesar foto"
                        >
                          <Search className="h-4 w-4 stroke-[2.5]" />
                        </button>

                        {/* Select Button (Kanan) - Selalu tampil saat terpilih, atau saat hover saat belum terpilih */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggle(photo)
                          }}
                          className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 cursor-pointer pointer-events-auto ${
                            isSelected
                              ? 'border-2 border-white bg-[#C9A26A] text-stone-950 opacity-100'
                              : 'border-2 border-white bg-black/60 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100'
                          }`}
                          title={isSelected ? 'Batalkan pilihan' : 'Pilih foto ini'}
                        >
                          <Check className="h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[3.5]" />
                        </button>
                      </div>

                      {/* Bottom-Right Order Badge (Badge Nomor Urut Terpilih) */}
                      {isSelected && (
                        <span className="absolute bottom-2 right-2 z-20 flex items-center justify-center rounded-full bg-[#C9A26A] text-stone-950 font-bold text-[10px] sm:text-[11px] min-w-[22px] h-[22px] px-1.5 shadow-md pointer-events-none">
                          {selectionIdx + 1}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Navigasi Selanjutnya: Semua Foto di tab Highlight */}
        {mainTab === 'highlight' && highlightPhotos.length > 0 && (
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
                style={{ fontFamily: "'Cormorant', 'Cormorant Garamond', Georgia, serif" }}
                className="text-[15px] font-normal text-white group-hover:text-white transition-colors leading-none tracking-normal"
              >
                Semua Foto
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[#C9A26A] group-hover:translate-y-0.5 transition-transform shrink-0" />
            </button>
          </div>
        )}

        {/* Footer Brand (Posisikan di bagian bawah sebagai footer) */}
        <footer
          style={{ fontFamily: "'Inter', sans-serif" }}
          className="w-full border-t border-white/10 mt-auto pt-6 pb-2.5 sm:pb-3 text-center select-none"
        >
          <p className="text-[10px] font-normal tracking-[0.25em] text-[#888888] uppercase leading-relaxed">
            PHOTO BY{' '}
            <strong className="font-bold text-white tracking-[0.25em]">
              LIVESOSTORY.CO
            </strong>
          </p>
        </footer>
      </main>

      {/* Floating Bottom Bar (Full-Width Edge-to-Edge: Lihat Pilihan & Kirim Pilihan) */}
      <div
        className={`fixed bottom-0 inset-x-0 z-40 border-t py-2 sm:py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] px-2 sm:px-4 shadow-2xl backdrop-blur-md transition-all ${
          isDarkMode
            ? 'border-white/10 bg-[#0c0d0e]/95 text-white'
            : 'border-stone-200 bg-white/95 text-stone-900'
        }`}
      >
        <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Button "Lihat Pilihan" (Contoh Gambar 1) */}
          <button
            type="button"
            onClick={() => setMainTab(mainTab === 'terpilih' ? 'semua' : 'terpilih')}
            className={`rounded-lg border px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap active:scale-95 shrink-0 ${
              mainTab === 'terpilih'
                ? 'bg-[#ba965c] border-[#ba965c] text-white font-semibold'
                : isDarkMode
                ? 'bg-[#1a1a1c] hover:bg-[#252528] border-white/15 text-white'
                : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800'
            }`}
          >
            Lihat Pilihan {selectedCount > 0 && `(${selectedCount})`}
          </button>

          {/* Right: Main Button "Kirim Pilihan" (Diblokir jika belum mencapai kuota maksimal) */}
          <button
            type="button"
            onClick={() => {
              if (selectedCount < maxPhotos) {
                const sisa = maxPhotos - selectedCount
                showToast(`Pilih ${sisa} foto lagi untuk mencapai batas ${maxPhotos} foto (${selectedCount}/${maxPhotos})`)
                return
              }
              setSubmitModalTab('photos')
              setIsSubmitModalOpen(true)
              if (gallery && gallery.status !== 'Selesai dipilih') {
                const updated = { ...gallery, status: 'Selesai dipilih' as const }
                setGallery(updated)
                saveOrUpdateGallery(updated)
              }
            }}
            title={
              selectedCount < maxPhotos
                ? `Pilih ${maxPhotos - selectedCount} foto lagi untuk mengirim pilihan (${selectedCount}/${maxPhotos})`
                : 'Kirim Pilihan'
            }
            style={{ fontFamily: 'Arial, sans-serif' }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-[16px] font-bold transition-all shadow-md select-none ${
              selectedCount >= maxPhotos
                ? 'bg-[#ba965c] hover:bg-[#c6a268] text-white active:scale-[0.99] cursor-pointer'
                : 'bg-[#ba965c]/35 text-white/45 border border-white/5 cursor-not-allowed hover:bg-[#ba965c]/30'
            }`}
          >
            <Send className="h-4 w-4 shrink-0 -rotate-12 sm:rotate-0" />
            <span>Kirim Pilihan</span>
          </button>
        </div>
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-20 right-3 sm:right-6 z-30 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border shadow-xl backdrop-blur-md transition-all active:scale-90 cursor-pointer animate-in fade-in zoom-in-90 duration-200 ${
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

      {/* Lightbox / Modal */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
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
            className="absolute left-1.5 sm:left-6 top-1/2 -translate-y-1/2 z-50 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 sm:bg-white/10 sm:hover:bg-white/25 active:scale-90 text-white transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-lg"
            title="Foto Sebelumnya (Panah Kiri)"
          >
            <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Right Arrow */}
          <button
            type="button"
            onClick={nextPhoto}
            className="absolute right-1.5 sm:right-6 top-1/2 -translate-y-1/2 z-50 flex h-8 w-8 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 sm:bg-white/10 sm:hover:bg-white/25 active:scale-90 text-white transition-all cursor-pointer backdrop-blur-md border border-white/15 shadow-lg"
            title="Foto Selanjutnya (Panah Kanan)"
          >
            <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Center Main Photo Container (Supports Single View and Split Compare View) */}
          <div
            className="relative flex h-full w-full items-center justify-center p-2 sm:p-8"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {isCompareMode && comparePhoto ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full w-full max-w-6xl items-center justify-center p-2 sm:p-4">
                {/* Photo A */}
                <div className="relative flex flex-col items-center justify-center h-full max-h-[75vh]">
                  <img
                    src={activePhoto.url || (activePhoto.fileId ? `https://drive.google.com/thumbnail?id=${activePhoto.fileId}&sz=w1200` : activePhoto.thumbnailUrl || '')}
                    alt={activePhoto.filename}
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePhotoImgError(e, activePhoto, 1200)}
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
                    src={comparePhoto.url || (comparePhoto.fileId ? `https://drive.google.com/thumbnail?id=${comparePhoto.fileId}&sz=w1200` : comparePhoto.thumbnailUrl || '')}
                    alt={comparePhoto.filename}
                    referrerPolicy="no-referrer"
                    onError={(e) => handlePhotoImgError(e, comparePhoto, 1200)}
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
                src={activePhoto.url || (activePhoto.fileId ? `https://drive.google.com/thumbnail?id=${activePhoto.fileId}&sz=w1600` : activePhoto.thumbnailUrl || '')}
                alt={activePhoto.filename}
                referrerPolicy="no-referrer"
                onError={(e) => handlePhotoImgError(e, activePhoto, 1600)}
                className="max-h-[76dvh] sm:max-h-[88dvh] max-w-[96vw] sm:max-w-[94vw] w-auto h-auto object-contain rounded-lg shadow-2xl transition-transform duration-200"
              />
            )}
          </div>

          {/* Bottom Controls & Shortcut Hint */}
          <div className="absolute bottom-0 inset-x-0 z-50 flex flex-col items-center justify-center pb-4 sm:pb-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none gap-2">
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

                {selectedPhotoIds.includes(activePhoto.id) && availablePrintSizes.length > 0 && (
                  <select
                    value={photoPrintSizes[activePhoto.id] || ''}
                    onChange={(e) => setPhotoPrintSize(activePhoto.id, e.target.value)}
                    className="bg-black/80 hover:bg-black text-[#C9A26A] border border-[#C9A26A]/50 rounded-full text-xs font-bold px-3 py-2 shadow-lg cursor-pointer focus:outline-none backdrop-blur-md"
                    title="Pilih ukuran cetak"
                  >
                    <option value="" className="bg-[#181716] text-stone-400">File Digital (Tanpa Cetak)</option>
                    {availablePrintSizes.map((s: string) => {
                      const quota = gallery?.printSizeQuotas?.[s] ?? 1
                      const used = selectedPhotoIds.filter((id) => photoPrintSizes[id] === s).length
                      const isSelected = photoPrintSizes[activePhoto.id] === s
                      const isFull = !isSelected && used >= quota
                      return (
                        <option
                          key={s}
                          value={s}
                          disabled={isFull}
                          className={isFull ? 'bg-[#181716] text-stone-500' : 'bg-[#181716] text-white'}
                        >
                          Cetak {s} {isFull ? '- Kuota Penuh' : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
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

      {/* Confirmation Modal to Send Selected Photos (Desain Baru: Grid Foto Terpilih + Ukuran Cetak) */}
      {isSubmitModalOpen && (() => {
        const selectedPhotos = photos.filter((p) => p && selectedPhotoIds.includes(p.id))
        const printSizeQuotas: Record<string, number> = gallery?.printSizeQuotas || {}
        const hasPrintSizes = availablePrintSizes.length > 0

        // Menghitung berapa foto yang menggunakan ukuran tertentu
        const getUsageCountForSize = (size: string) => {
          return selectedPhotos.filter((p) => photoPrintSizes[p.id] === size).length
        }

        // Total kuota cetak yang ditentukan admin & total yang sudah dialokasikan
        const totalQuotaNeeded = hasPrintSizes
          ? availablePrintSizes.reduce((sum, size) => sum + (printSizeQuotas[size] ?? 1), 0)
          : 0
        const totalQuotaUsed = hasPrintSizes
          ? availablePrintSizes.reduce((sum, size) => sum + getUsageCountForSize(size), 0)
          : 0
        const remainingQuota = Math.max(0, totalQuotaNeeded - totalQuotaUsed)

        // Validasi: seluruh kuota untuk setiap ukuran yang aktif harus terpenuhi
        const isAllPrintSizesChosen =
          !hasPrintSizes ||
          availablePrintSizes.every((size) => {
            const quota = printSizeQuotas[size] ?? 1
            const used = getUsageCountForSize(size)
            return used === quota
          })

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in"
            onClick={() => setIsSubmitModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl max-h-[96dvh] h-[96dvh] sm:max-h-[92dvh] sm:h-[92dvh] rounded-2xl sm:rounded-3xl border border-stone-800 bg-[#121110] text-stone-100 shadow-2xl flex flex-col overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="border-b border-stone-800/80 px-3.5 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 bg-[#181716]">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#C9A26A]/15 border border-[#C9A26A]/30 text-[#C9A26A] flex items-center justify-center font-bold shrink-0">
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-none">
                        Konfirmasi Pilihan Foto — {gallery?.clientName}
                      </h3>
                      <span className="text-[11px] sm:text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 sm:px-2.5 py-0.5 rounded-full font-semibold shrink-0">
                        {selectedCount} dari {maxPhotos} Foto
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                      Periksa dan konfirmasi foto pilihan Anda sebelum dikirim.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="text-stone-400 hover:text-white p-1.5 sm:p-2 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                  title="Tutup (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Tab Switcher */}
              <div className="lg:hidden flex border-b border-stone-800 bg-[#161514] px-3 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSubmitModalTab('photos')}
                  className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    submitModalTab === 'photos'
                      ? 'border-[#C9A26A] text-[#C9A26A]'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>1. Pilih Foto ({selectedPhotos.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubmitModalTab('summary')}
                  className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    submitModalTab === 'summary'
                      ? 'border-[#C9A26A] text-[#C9A26A]'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>2. Ringkasan & Kirim</span>
                  {hasPrintSizes && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isAllPrintSizesChosen
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {totalQuotaUsed}/{totalQuotaNeeded}
                    </span>
                  )}
                </button>
              </div>

              {/* Modal Body: Split Kiri (Foto Preview + Pilihan Ukuran) & Kanan (Ringkasan & Aksi) */}
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                {/* SISI KIRI: Grid Foto Terpilih dengan Thumbnail Real & Button Ukuran Cetak */}
                <div
                  className={`flex-1 flex-col min-h-0 overflow-y-auto p-3 sm:p-5 min-w-0 [scrollbar-width:thin] [scrollbar-color:#2e2c29_transparent] ${
                    submitModalTab === 'photos' ? 'flex' : 'hidden lg:flex'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs font-semibold text-stone-300">
                      Foto Terpilih ({selectedPhotos.length}):
                    </p>
                    {hasPrintSizes && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-stone-400">Kuota Cetak:</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isAllPrintSizesChosen
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {totalQuotaUsed} / {totalQuotaNeeded} foto {isAllPrintSizesChosen ? '✓' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                  {hasPrintSizes && (
                    <p className="text-xs sm:text-sm text-amber-300 mb-2 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5 leading-relaxed">
                      Pilih ukuran cetak untuk setiap foto menggunakan tombol di bawah foto, lalu kirim ke WhatsApp fotografer.
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
                    {selectedPhotos.map((photo, idx) => {
                      const printSize = photoPrintSizes[photo.id]
                      return (
                        <div
                          key={photo.id || idx}
                          className={`group relative rounded-xl overflow-hidden border bg-[#0e0d0c] shadow-sm flex flex-col transition-all ${
                            printSize
                              ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                              : 'border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          {/* Photo Thumbnail Container */}
                          <div
                            onClick={() => {
                              const foundIdx = filteredPhotos.findIndex((p) => p && p.id === photo.id)
                              openLightbox(photo, foundIdx >= 0 ? foundIdx : idx)
                            }}
                            className="relative aspect-square w-full bg-neutral-900 cursor-pointer overflow-hidden"
                            title="Klik untuk melihat foto lebih besar"
                          >
                            <img
                              src={getPhotoThumbnailUrl(photo, 600)}
                              alt={photo.filename}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => handlePhotoImgError(e, photo, 600)}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />

                            {/* Number badge */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-bold text-[#C9A26A] border border-[#C9A26A]/40 z-10">
                              #{idx + 1}
                            </div>

                            {/* Print Size Tag if selected */}
                            {printSize ? (
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow-md flex items-center gap-1 z-10 animate-in fade-in">
                                <Check className="h-3 w-3 stroke-[3]" />
                                <span>{printSize}</span>
                              </div>
                            ) : (
                              <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white/70 flex items-center justify-center shadow-md z-10">
                                <Check className="h-3.5 w-3.5 stroke-[2]" />
                              </div>
                            )}

                            {/* Filename Overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
                              <p className="text-[11px] font-medium text-white truncate font-mono">
                                {photo.filename}
                              </p>
                            </div>
                          </div>

                          {/* Print Size Selection Control (Button Pills seperti di Halaman Admin) */}
                          {hasPrintSizes && (
                            <div className="p-2 bg-[#161514] border-t border-stone-800/80 flex flex-col gap-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-semibold text-stone-400">Pilih Ukuran:</span>
                                {printSize ? (
                                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                                    <span>Cetak {printSize}</span>
                                  </span>
                                ) : (
                                  <span className="text-stone-500 font-medium">File Digital</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {availablePrintSizes.map((size: string) => {
                                  const isSelected = printSize === size
                                  const quota = printSizeQuotas[size] ?? 1
                                  const used = getUsageCountForSize(size)
                                  const isQuotaFull = used >= quota
                                  const isDisabled = !isSelected && isQuotaFull

                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      disabled={isDisabled}
                                      onClick={() => setPhotoPrintSize(photo.id, isSelected ? '' : size)}
                                      title={
                                        isDisabled
                                          ? `Kuota ${size} sudah penuh (${used}/${quota} foto)`
                                          : isSelected
                                          ? `Klik untuk membatalkan ukuran ${size}`
                                          : `Pilih ukuran ${size} (${used}/${quota} foto)`
                                      }
                                      className={`flex-1 min-w-[44px] py-1.5 px-1 rounded-md text-[11px] font-bold border transition-all flex items-center justify-center gap-0.5 ${
                                        isSelected
                                          ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-300 shadow-xs cursor-pointer'
                                          : isDisabled
                                          ? 'bg-[#121110] border-stone-800/60 text-stone-600 opacity-40 cursor-not-allowed'
                                          : 'bg-[#0e0d0c] border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200 cursor-pointer'
                                      }`}
                                    >
                                      {isSelected && (
                                        <Check className="h-2.5 w-2.5 stroke-[3] text-emerald-400 shrink-0" />
                                      )}
                                      <span>{size}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Mobile Action Bar for Tab Foto */}
                  <div className="lg:hidden shrink-0 pt-3 mt-3 border-t border-stone-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="rounded-xl border border-stone-800 bg-[#242220] hover:bg-[#2d2a27] text-stone-300 px-3.5 py-2.5 text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                    {isAllPrintSizesChosen ? (
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] py-2.5 px-3 text-xs font-bold text-slate-950 shadow-md cursor-pointer flex items-center justify-center gap-1.5 animate-in fade-in"
                      >
                        <Send className="h-4 w-4" />
                        <span>Kirim via WhatsApp</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSubmitModalTab('summary')}
                        className="flex-1 rounded-xl bg-[#201e1c] hover:bg-[#2a2724] border border-stone-700 py-2.5 px-3 text-xs font-semibold text-[#C9A26A] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>Lihat Ringkasan ({totalQuotaUsed}/{totalQuotaNeeded})</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* SISI KANAN: Ringkasan, Textarea & Tombol Kirim WhatsApp */}
                <div
                  className={`w-full lg:w-[380px] xl:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-stone-800 bg-[#141312] p-4 sm:p-5 flex-col overflow-y-auto min-h-0 flex-1 lg:flex-initial ${
                    submitModalTab === 'summary' ? 'flex' : 'hidden lg:flex'
                  }`}
                >
                  {/* Summary Card */}
                  <div className="rounded-xl border border-stone-800 bg-[#0e0d0c] p-3.5 space-y-2 text-xs mb-3">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-400">Klien / Acara:</span>
                      <span className="font-semibold text-white truncate max-w-[200px]">{gallery?.clientName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-400">Total Foto Dipilih:</span>
                      <span className="font-bold text-[#C9A26A]">
                        {selectedPhotos.length} dari {maxPhotos} foto
                      </span>
                    </div>
                    {hasPrintSizes && (
                      <div className="pt-2 border-t border-stone-800/80 space-y-1.5">
                        <span className="text-stone-400 font-medium block">Kuota Ukuran Cetak:</span>
                        <div className="space-y-1">
                          {availablePrintSizes.map((size) => {
                            const quota = printSizeQuotas[size] ?? 1
                            const used = getUsageCountForSize(size)
                            const isFull = used === quota
                            return (
                              <div key={size} className="flex justify-between items-center text-xs">
                                <span className="text-stone-300 font-semibold">{size}:</span>
                                <span className={isFull ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                                  {used} / {quota} foto {isFull ? '✓ Selesai' : `(Kurang ${quota - used})`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notification Alert */}
                  {isAllPrintSizesChosen ? (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-950/40 border border-emerald-800/50 px-3 py-2 text-xs font-medium text-emerald-300 mb-3 animate-in fade-in">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Semua ukuran cetak sudah sesuai kuota! Siap dikirim ke fotografer.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-950/30 border border-amber-800/40 px-3 py-2 text-xs font-medium text-amber-300 mb-3 animate-in fade-in">
                      <span className="text-amber-400 font-bold shrink-0">⚠️</span>
                      <span>
                        Tentukan foto untuk {remainingQuota} kuota cetak yang belum dipilih sebelum mengirim ke WhatsApp.
                      </span>
                    </div>
                  )}

                  {/* Header Textarea & Tombol Salin */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-stone-200">
                      Format pesan WhatsApp:
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyList}
                      className="px-2.5 py-1 rounded-md bg-[#242220] hover:bg-[#2d2a27] border border-stone-700 text-[#C9A26A] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Salin pesan & daftar foto"
                    >
                      {isCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Textarea Preview */}
                  <div className="flex-1 min-h-[140px] rounded-xl border border-stone-800 bg-[#0a0a09] p-3 flex flex-col mb-4 overflow-hidden">
                    <textarea
                      readOnly
                      rows={6}
                      value={selectedPhotos
                        .map((p) => {
                          const name = p.filename || `Foto-${p.id}`
                          const size = availablePrintSizes.length > 0 ? photoPrintSizes[p.id] : undefined
                          return size ? `${name} — cetak ${size},` : `${name},`
                        })
                        .join('\n')}
                      className="w-full flex-1 font-mono text-xs text-stone-300 bg-transparent resize-none focus:outline-none select-all leading-relaxed"
                      title="Pratinjau pesan yang akan dikirim"
                    />
                  </div>

                  {/* Action Buttons: Batal & Kirim via WhatsApp */}
                  <div className="flex items-center gap-2.5 pt-1 mt-auto">
                    <button
                      type="button"
                      onClick={() => setSubmitModalTab('photos')}
                      className="lg:hidden rounded-xl border border-stone-800 bg-[#242220] hover:bg-[#2d2a27] text-stone-300 px-3.5 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      ← Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(false)}
                      className="hidden lg:block rounded-xl border border-stone-800 bg-[#242220] hover:bg-[#2d2a27] text-stone-300 px-4 py-2.5 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    {isAllPrintSizesChosen ? (
                      <button
                        type="button"
                        onClick={handleOpenWhatsApp}
                        className="flex-1 rounded-xl bg-gradient-to-r from-[#9C7844] to-[#C9A26A] hover:brightness-110 active:scale-[0.99] py-2.5 px-4 text-xs font-bold text-slate-950 shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 animate-in fade-in"
                      >
                        <Send className="h-4 w-4" />
                        <span>Kirim via WhatsApp</span>
                      </button>
                    ) : (
                      <div className="flex-1 rounded-xl bg-amber-500/10 border border-amber-500/20 py-2.5 px-3 text-center text-xs font-semibold text-amber-300/80 select-none cursor-not-allowed">
                        Tentukan Ukuran Cetak ({totalQuotaUsed}/{totalQuotaNeeded})
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
