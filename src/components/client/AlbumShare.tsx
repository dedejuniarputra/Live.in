import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import {
  Share2,
  Download,
  Lock,
  Image as ImageIcon,
  KeyRound,
  Copy,
  Calendar,
  Sparkles,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react'
import {
  findGalleryBySlug,
  saveOrUpdateGallery,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'

export default function AlbumShare() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const [gallery, setGallery] = useState<GalleryData | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState<GalleryPhoto | null>(null)
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [touchEndX, setTouchEndX] = useState<number | null>(null)

  // Modals for the features requested:
  // "(bisa atur siapa yang lihat, ganti sampul, bikin pin)"
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false)
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [isPinLocked, setIsPinLocked] = useState(false)
  const [enteredPin, setEnteredPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)

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
      const cleanSlug = (rawSlug || 'wisuda-putra-22-agustus-2026').replace(/-3$/, '')
      const data = findGalleryBySlug(cleanSlug)
      if (data) {
        setGallery(data)
        if (data.pinCode) {
          setIsPinLocked(true)
        }
        if (data.clientName) {
          document.title = `${data.clientName} — Album Kenangan`
        }
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

  const handlePrevPhoto = () => {
    if (!gallery) return
    const currentPhotos = Array.isArray(gallery.photos) ? gallery.photos : []
    if (currentPhotos.length === 0) return
    const prev = (activePhotoIndex - 1 + currentPhotos.length) % currentPhotos.length
    setActivePhotoIndex(prev)
    setActivePhoto(currentPhotos[prev])
  }

  const handleNextPhoto = () => {
    if (!gallery) return
    const currentPhotos = Array.isArray(gallery.photos) ? gallery.photos : []
    if (currentPhotos.length === 0) return
    const next = (activePhotoIndex + 1) % currentPhotos.length
    setActivePhotoIndex(next)
    setActivePhoto(currentPhotos[next])
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
  }, [activePhoto, activePhotoIndex, gallery])

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
              const fallback = findGalleryBySlug('wisuda-putra-22-agustus-2026')
              if (fallback) setGallery(fallback)
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
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl bg-stone-900 border border-stone-700 px-5 py-3 text-xs font-medium text-white shadow-2xl backdrop-blur-xl animate-in fade-in">
          <Sparkles className="h-4 w-4 text-[#C9A26A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090D16]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo"
              className="h-8 w-auto max-w-[130px] object-contain"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src =
                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="34" viewBox="0 0 120 34" fill="none"><rect width="120" height="34" rx="6" fill="%230f172a" stroke="%23334155" stroke-dasharray="3 3"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="10" font-weight="600" font-family="sans-serif">Livesostory.co</text></svg>'
              }}
            />
            <div className="hidden sm:block h-4 w-px bg-slate-800" />
            <span className="hidden sm:inline text-xs font-semibold text-[#C9A26A]">
              Memories & Album Bersama
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/livesotory-co/${gallery.slug}`}
              className="rounded-xl border border-[#9C7844]/50 bg-[#9C7844]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E8C28A] hover:bg-[#9C7844]/20 transition-colors"
            >
              Halaman Pilih Foto
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Cover Banner */}
      <section className="relative h-[360px] sm:h-[420px] w-full overflow-hidden bg-slate-950">
        <img
          src={gallery.coverUrl || (Array.isArray(gallery.photos) && gallery.photos[0]?.url) || ''}
          alt="Album Cover"
          className="h-full w-full object-cover brightness-60 transition-transform duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090D16] via-[#090D16]/50 to-transparent" />

        <div className="absolute inset-x-0 bottom-8 mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-3 py-1 text-[11px] font-semibold text-white">
                <Sparkles className="h-3 w-3 text-[#E8C28A]" /> Album Kenangan
              </span>
              <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {gallery.clientName} & Moments
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-[#E8C28A]" />
                <span>Diabadikan pada {gallery.date}</span>
                <span>•</span>
                <span>{(Array.isArray(gallery.photos) ? gallery.photos.length : 0)} Foto Google Drive</span>
              </p>
            </div>

            {/* Quick Album Management Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCoverModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-md hover:bg-black/70 transition-colors cursor-pointer"
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
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium backdrop-blur-md transition-colors cursor-pointer ${
                  gallery.pinCode
                    ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/20 bg-black/50 text-white hover:bg-black/70'
                }`}
                title="Atur Siapa yang Melihat / PIN"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#E8C28A]" />
                <span>{gallery.pinCode ? 'PIN Aktif' : 'Bikin PIN'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 rounded-xl bg-[#1E824C] hover:bg-[#16683C] px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-colors cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Bagikan WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/50 px-3 py-2 text-xs font-medium text-white backdrop-blur-md hover:bg-black/70 transition-colors cursor-pointer"
                title="Salin Link Album"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Link</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Album Photos Masonry Grid */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">
              Semua Momen ({(Array.isArray(gallery.photos) ? gallery.photos.length : 0)})
            </h2>
            <p className="text-xs text-slate-400">
              Streaming langsung dari Google Drive tanpa membebani storage lokal
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 sm:gap-5">
          {(Array.isArray(gallery.photos) ? gallery.photos : []).map((photo, index) => (
            <div
              key={photo.id}
              onClick={() => {
                setActivePhotoIndex(index)
                setActivePhoto(photo)
              }}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 cursor-pointer transition-all duration-300 hover:border-[#C9A26A]/50 hover:shadow-xl hover:shadow-black/50"
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
                  } else if (photo.url && target.src !== photo.url) {
                    target.src = photo.url
                  }
                }}
                className="w-full aspect-[4/5] object-cover block transition-transform duration-500 group-hover:scale-105"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="font-mono text-[10px] text-white bg-black/70 px-2 py-0.5 rounded-md backdrop-blur-xs truncate max-w-[75%]">
                  {photo.filename}
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-xs">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox Modal (Exact Matching Contoh Gambar 1) */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in">
          {/* Top Bar: Left Counter & Right Action Buttons */}
          <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
            {/* Top Left: Counter (e.g. 2 / 80) */}
            <div className="pointer-events-auto text-sm sm:text-base font-normal tracking-wide text-white/90">
              {activePhotoIndex + 1} / {(Array.isArray(gallery.photos) ? gallery.photos.length : 1)}
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
