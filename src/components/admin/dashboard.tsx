import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  LogOut,
  Check,
  CheckCircle2,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  AlertCircle,
  FolderKanban,
  Search,
  Share2,
  Folder,
  Calendar,
  Phone,
  Clock,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
} from 'lucide-react'
import { createZipBlob } from '../../lib/zipHelper.ts'
import { signOutAdmin } from '../../lib/firebase.ts'
import {
  getStoredGalleries,
  saveOrUpdateGallery,
  updateGallery,
  deleteGallery,
  deleteMultipleGalleries,
  syncGalleriesFromFirestore,
  type GalleryData,
  type GalleryPhoto,
} from '../../lib/galleryStore.ts'
import {
  scanGoogleDriveFolder,
  extractDriveFolderId,
  type DrivePhotoItem,
} from '../../lib/googleDrive.ts'

export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loginSuccessToast, setLoginSuccessToast] = useState(false)
  const [createSuccessToast, setCreateSuccessToast] = useState<{
    clientName: string
    photoCount: number
  } | null>(null)
  const [copySuccessToast, setCopySuccessToast] = useState<string | null>(null)
  const [isCopiedAll, setIsCopiedAll] = useState(false)

  useEffect(() => {
    if (copySuccessToast) {
      const timer = setTimeout(() => {
        setCopySuccessToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [copySuccessToast])

  // Timer auto-dismiss 3 detik untuk notifikasi login berhasil
  useEffect(() => {
    if (loginSuccessToast) {
      const timer = setTimeout(() => {
        setLoginSuccessToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [loginSuccessToast])

  // Timer auto-dismiss 3 detik untuk notifikasi galeri berhasil dibuat
  useEffect(() => {
    if (createSuccessToast) {
      const timer = setTimeout(() => {
        setCreateSuccessToast(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [createSuccessToast])

  // Notifikasi login berhasil dari halaman Login (hanya tampil setelah login, tidak saat refresh)
  useEffect(() => {
    const hasSessionFlag = sessionStorage.getItem('login_success_toast') === '1'
    const hasStateFlag = Boolean((location.state as any)?.loginSuccess)

    if (hasSessionFlag || hasStateFlag) {
      sessionStorage.removeItem('login_success_toast')
      if (hasStateFlag) {
        navigate(location.pathname, { replace: true, state: {} })
      }
      setLoginSuccessToast(true)
    }
  }, [location.state, location.pathname, navigate])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<
    'Semua' | 'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih'
  >('Semua')

  // Permanent dark theme & document title for Admin Dashboard
  useEffect(() => {
    document.title = 'Live.IN | Dashboard Admin'
    document.documentElement.classList.add('dark')
    localStorage.setItem('livein-theme', 'dark')
  }, [])

  // Navbar transparent on top, blur on scroll
  const [isScrolled, setIsScrolled] = useState(false)
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Galleries list state (synced with storage & client routes)
  const [galleries, setGalleries] = useState<GalleryData[]>(() =>
    getStoredGalleries()
  )

  useEffect(() => {
    setGalleries(getStoredGalleries())
    syncGalleriesFromFirestore().then((remote) => {
      if (remote && remote.length > 0) {
        setGalleries([...remote])
      }
    })
    const handleStorage = () => setGalleries(getStoredGalleries())
    window.addEventListener('storage', handleStorage)
    window.addEventListener('galleries-updated', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('galleries-updated', handleStorage)
    }
  }, [])

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

    const fullMessage = `Hallo Kak, ${gallery.clientName.toUpperCase()} 👋
Foto-foto dokumentasi dari Livesostory sudah siap nih!

Yuk pilih foto favorit kamu di sini:
👉 ${selectionLink}

Mau pamerin ke teman & keluarga? Tinggal share link ini ya:
👉 ${albumLink}

Selamat memilih foto dan enjoy your moments! ✨`

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
  const [maxPhotos, setMaxPhotos] = useState('')
  const [isMaxPhotosDropdownOpen, setIsMaxPhotosDropdownOpen] = useState(false)
  const [dropdownPlacement, setDropdownPlacement] = useState<'down' | 'up'>('down')
  const maxPhotosContainerRef = useRef<HTMLDivElement>(null)

  const toggleMaxPhotosDropdown = () => {
    if (!isMaxPhotosDropdownOpen && maxPhotosContainerRef.current) {
      const rect = maxPhotosContainerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 240 && rect.top > 240) {
        setDropdownPlacement('up')
      } else {
        setDropdownPlacement('down')
      }
    }
    setIsMaxPhotosDropdownOpen((prev) => !prev)
  }
  const [clientName, setClientName] = useState('')
  const [clientWhatsapp, setClientWhatsapp] = useState('')
  const [allowDownload, setAllowDownload] = useState(true)

  // Scanned photos preview state (Real-time scan hasil foto Drive)
  const [scannedPhotos, setScannedPhotos] = useState<DrivePhotoItem[]>([])
  const [isScanningLink, setIsScanningLink] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [detectedFolderName, setDetectedFolderName] = useState<string>('')
  const [previewLightboxPhoto, setPreviewLightboxPhoto] = useState<DrivePhotoItem | null>(null)
  const [showAllScannedModal, setShowAllScannedModal] = useState(false)
  const [galleryToDelete, setGalleryToDelete] = useState<GalleryData | null>(null)
  const [viewingSelectedGallery, setViewingSelectedGallery] = useState<GalleryData | null>(null)
  const [selectedLightboxPhoto, setSelectedLightboxPhoto] = useState<GalleryPhoto | null>(null)

  const confirmDeleteGallery = (gallery: GalleryData) => {
    const updated = deleteGallery(gallery.id, gallery.slug)
    setGalleries([...updated])
    setGalleryToDelete(null)
    showToast(`Galeri "${gallery.clientName}" berhasil dihapus.`)
  }

  // Edit Gallery Modal State & Handlers
  const [editingGallery, setGalleryToEdit] = useState<GalleryData | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editMaxPhotos, setEditMaxPhotos] = useState('60')
  const [isEditMaxPhotosDropdownOpen, setIsEditMaxPhotosDropdownOpen] = useState(false)
  const [editDropdownPlacement, setEditDropdownPlacement] = useState<'down' | 'up'>('down')
  const editMaxPhotosContainerRef = useRef<HTMLDivElement>(null)

  const toggleEditMaxPhotosDropdown = () => {
    if (!isEditMaxPhotosDropdownOpen && editMaxPhotosContainerRef.current) {
      const rect = editMaxPhotosContainerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 240 && rect.top > 240) {
        setEditDropdownPlacement('up')
      } else {
        setEditDropdownPlacement('down')
      }
    }
    setIsEditMaxPhotosDropdownOpen((prev) => !prev)
  }
  const [editStatus, setEditStatus] = useState<
    'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih'
  >('Belum mulai')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editDriveLink, setEditDriveLink] = useState('')
  const [editPinCode, setEditPinCode] = useState('')
  const [editIsClientViewed, setEditIsClientViewed] = useState(false)
  const [editNewScannedPhotos, setEditNewScannedPhotos] = useState<
    DrivePhotoItem[] | null
  >(null)
  const [isEditScanning, setIsEditScanning] = useState(false)
  const [editScanError, setEditScanError] = useState<string | null>(null)
  const [editScanSuccessMsg, setEditScanSuccessMsg] = useState<string | null>(null)

  const openEditModal = (gallery: GalleryData) => {
    setGalleryToEdit(gallery)
    setEditClientName(gallery.clientName || '')
    setEditSlug(gallery.slug || '')
    setEditMaxPhotos(String(gallery.maxPhotos || 60))
    setIsEditMaxPhotosDropdownOpen(false)
    setEditStatus(gallery.status || 'Belum mulai')
    setEditWhatsapp(gallery.whatsapp || '')
    setEditDriveLink(gallery.driveLink || '')
    setEditPinCode(gallery.pinCode || '')
    setEditIsClientViewed(Boolean(gallery.isClientViewed))
    setEditNewScannedPhotos(null)
    setIsEditScanning(false)
    setEditScanError(null)
    setEditScanSuccessMsg(null)
  }

  const handleEditWhatsappChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '')
    setEditWhatsapp(sanitized)
  }

  const handleEditRescanDrive = async () => {
    const url = editDriveLink.trim()
    if (!url) {
      setEditScanError('Masukkan link Google Drive terlebih dahulu.')
      return
    }

    const folderId = extractDriveFolderId(url)
    if (!folderId) {
      setEditScanError(
        'Link folder Google Drive tidak valid atau ID folder tidak ditemukan.'
      )
      return
    }

    setIsEditScanning(true)
    setEditScanError(null)
    setEditScanSuccessMsg(null)

    try {
      const res = await scanGoogleDriveFolder(url)
      setIsEditScanning(false)
      if (res.success && res.photos && res.photos.length > 0) {
        setEditNewScannedPhotos(res.photos)
        if (res.folderName) {
          setEditClientName(res.folderName)
        }
        setEditScanSuccessMsg(
          `Berhasil memindai ${res.photos.length} foto dari Google Drive!`
        )
      } else {
        setEditScanError(
          res.error ||
            'Folder Google Drive kosong atau tidak dapat diakses. Pastikan hak akses diset "Siapa saja yang memiliki link" -> "Pelihat".'
        )
      }
    } catch (err: any) {
      setIsEditScanning(false)
      setEditScanError(err?.message || 'Gagal memindai folder Google Drive.')
    }
  }

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (!editingGallery) return

    const trimmedName = editClientName.trim() || editingGallery.clientName
    const trimmedWhatsapp = editWhatsapp.replace(/\D/g, '')

    if (!trimmedWhatsapp) {
      showToast('Nomor WhatsApp wajib diisi.')
      return
    }

    const editAvailablePhotosCount = (
      editNewScannedPhotos && editNewScannedPhotos.length > 0
        ? editNewScannedPhotos
        : editingGallery.photos
    )?.length || 0
    const parsedEditMax = parseInt(editMaxPhotos) || editingGallery.maxPhotos

    if (editAvailablePhotosCount > 0 && parsedEditMax > editAvailablePhotosCount) {
      showToast(
        `Batas foto dipilih (${parsedEditMax}) tidak boleh melebihi jumlah foto yang tersedia (${editAvailablePhotosCount} foto).`
      )
      return
    }

    const safeSlug =
      (editSlug.trim() || trimmedName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || editingGallery.slug

    const updatedItem: GalleryData = {
      ...editingGallery,
      clientName: trimmedName,
      slug: safeSlug,
      maxPhotos: parseInt(editMaxPhotos) || editingGallery.maxPhotos,
      remainingDays: editingGallery.remainingDays || 0,
      status: editStatus,
      whatsapp: trimmedWhatsapp,
      driveLink: editDriveLink.trim() || editingGallery.driveLink,
      pinCode: editPinCode.trim() || undefined,
      isClientViewed: editIsClientViewed,
      photos:
        editNewScannedPhotos && editNewScannedPhotos.length > 0
          ? editNewScannedPhotos
          : editingGallery.photos,
      coverUrl:
        editNewScannedPhotos && editNewScannedPhotos.length > 0
          ? editNewScannedPhotos[0]?.url || editingGallery.coverUrl
          : editingGallery.coverUrl,
      selectedPhotos: editingGallery.selectedPhotoIds?.length || 0,
    }

    const updatedList = updateGallery(updatedItem)
    setGalleries([...updatedList])
    setGalleryToEdit(null)
    showToast(`Data galeri "${trimmedName}" berhasil diperbarui!`)
  }

  const handleOpenDriveFolder = (gallery: GalleryData) => {
    const rawLink = (gallery.driveLink || '').trim()

    if (!rawLink) {
      showToast(
        `Link Google Drive belum diisi untuk "${gallery.clientName}". Silakan lengkapi di Edit Galeri.`
      )
      openEditModal(gallery)
      return
    }

    let targetUrl = rawLink
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const folderId = extractDriveFolderId(targetUrl)
      if (folderId) {
        targetUrl = `https://drive.google.com/drive/folders/${folderId}`
      } else {
        targetUrl = `https://${targetUrl}`
      }
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    showToast(`Membuka folder Google Drive untuk "${gallery.clientName}"...`)
  }

  // Scanning modal state (saat submit)
  const [isScanningModalOpen, setIsScanningModalOpen] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStatusText, setScanStatusText] = useState('Membaca folder Drive...')

  // Status & feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleLogout = async () => {
    await signOutAdmin()
    sessionStorage.setItem('logout_success_toast', '1')
    navigate('/login', { state: { logoutSuccess: true } })
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  const [isDownloadingPhoto, setIsDownloadingPhoto] = useState(false)

  const handleShareSelectedPhoto = async (photo: GalleryPhoto) => {
    const baseUrl = window.location.origin
    const shareUrl = viewingSelectedGallery
      ? `${baseUrl}/livesotory-co/${viewingSelectedGallery.slug}`
      : window.location.href
    const photoDirectUrl = photo.url || shareUrl

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${viewingSelectedGallery?.clientName || 'Livesostory'} - ${photo.filename}`,
          text: `Lihat foto terpilih ${photo.filename} (${viewingSelectedGallery?.clientName || 'Livesostory'}):`,
          url: photoDirectUrl,
        })
        return
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(photoDirectUrl)
      setCopySuccessToast(`Tautan foto "${photo.filename}" berhasil disalin ke clipboard!`)
      showToast(`Tautan foto ${photo.filename} berhasil disalin!`)
    } catch {
      showToast('Gagal menyalin tautan foto.')
    }
  }

  const handleDownloadSelectedPhoto = async (photo: GalleryPhoto) => {
    setIsDownloadingPhoto(true)
    showToast(`Mengunduh ${photo.filename}...`)
    try {
      // 1. Coba download via proxy API untuk filename yang rapi
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
        setIsDownloadingPhoto(false)
        return
      }
    } catch (e) {
      console.warn('Proxy download error, falling back:', e)
    }

    // 2. Fallback direct download link Google Drive
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
      setIsDownloadingPhoto(false)
    }
  }

  const [isZipping, setIsZipping] = useState(false)
  const [zipProgressText, setZipProgressText] = useState('')

  const handleDownloadSelectedAsZip = async (
    photos: GalleryPhoto[],
    clientName: string
  ) => {
    if (!photos || photos.length === 0) {
      showToast('Tidak ada foto terpilih untuk diunduh.')
      return
    }

    setIsZipping(true)
    setZipProgressText(`Menyiapkan 0/${photos.length}...`)
    showToast(`Mulai mengunduh ${photos.length} foto terpilih menjadi ZIP...`)

    try {
      const zipFiles: { name: string; data: Uint8Array }[] = []

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i]
        setZipProgressText(`Mengunduh ${i + 1}/${photos.length}: ${photo.filename}`)

        let fileData: Uint8Array | null = null

        // 1. Coba download via proxy API internal
        try {
          const proxyUrl = `/api/download-photo?id=${encodeURIComponent(photo.fileId || '')}&url=${encodeURIComponent(photo.url)}&filename=${encodeURIComponent(photo.filename)}`
          const res = await fetch(proxyUrl)
          if (res.ok) {
            const buf = await res.arrayBuffer()
            fileData = new Uint8Array(buf)
          }
        } catch (e) {
          console.warn(`Proxy fetch failed for ${photo.filename}:`, e)
        }

        // 2. Fallback direct download link jika proxy gagal
        if (!fileData) {
          try {
            const fallbackUrl = photo.fileId
              ? `https://drive.google.com/uc?export=download&id=${photo.fileId}`
              : photo.url
            const res = await fetch(fallbackUrl)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              fileData = new Uint8Array(buf)
            }
          } catch (e) {
            console.warn(`Direct fetch fallback failed for ${photo.filename}:`, e)
          }
        }

        if (fileData && fileData.length > 0) {
          const cleanName = (photo.filename || `foto-${i + 1}.jpg`).replace(/[\\/:*?"<>|]/g, '_')
          zipFiles.push({
            name: cleanName,
            data: fileData,
          })
        }
      }

      if (zipFiles.length === 0) {
        showToast('Gagal mengunduh file foto dari Google Drive. Pastikan akses folder publik.')
        setIsZipping(false)
        setZipProgressText('')
        return
      }

      setZipProgressText('Membuat arsip ZIP...')
      const zipBlob = createZipBlob(zipFiles)
      const zipUrl = window.URL.createObjectURL(zipBlob)

      const safeClientName = (clientName || 'Klien')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
      const zipFilename = `Foto_Pilihan_${safeClientName}_${zipFiles.length}_foto.zip`

      const a = document.createElement('a')
      a.href = zipUrl
      a.download = zipFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(zipUrl)

      showToast(`Berhasil mengunduh ${zipFiles.length} foto dalam format ZIP!`)
    } catch (err: any) {
      console.error('ZIP download error:', err)
      showToast(err?.message || 'Terjadi kesalahan saat memproses file ZIP.')
    } finally {
      setIsZipping(false)
      setZipProgressText('')
    }
  }

  const handleWhatsappChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '')
    setClientWhatsapp(sanitized)
  }

  // Reset seluruh input form pembuatan galeri ke kondisi awal
  const handleResetCreateForm = () => {
    setDriveLink('')
    setMaxPhotos('')
    setIsMaxPhotosDropdownOpen(false)
    setClientName('')
    setClientWhatsapp('')
    setAllowDownload(true)
    setScannedPhotos([])
    setIsScanningLink(false)
    setScanError(null)
    setDetectedFolderName('')
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
      const result = await scanGoogleDriveFolder(trimmed)
      setIsScanningLink(false)

      if (result.success && result.photos && result.photos.length > 0) {
        setScannedPhotos(result.photos)
        if (result.folderName) {
          setDetectedFolderName(result.folderName)
          setClientName(result.folderName)
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    let cleanDriveLink = driveLink.trim()
    if (cleanDriveLink && !cleanDriveLink.startsWith('http://') && !cleanDriveLink.startsWith('https://')) {
      cleanDriveLink = `https://${cleanDriveLink}`
      setDriveLink(cleanDriveLink)
    }

    if (!cleanDriveLink) {
      showToast('Harap masukkan Link Folder Google Drive.')
      document.getElementById('driveLink')?.focus()
      return
    }
    if (!clientName.trim()) {
      showToast('Harap masukkan Nama Klien / Acara.')
      document.getElementById('clientName')?.focus()
      return
    }
    if (!clientWhatsapp.trim()) {
      showToast('Harap masukkan Nomor WhatsApp Klien.')
      document.getElementById('clientWhatsapp')?.focus()
      return
    }

    const parsedMaxPhotosInput = parseInt(maxPhotos) || 60
    if (scannedPhotos.length > 0 && parsedMaxPhotosInput > scannedPhotos.length) {
      showToast(
        `Batas foto dipilih (${parsedMaxPhotosInput}) tidak boleh melebihi jumlah foto di Google Drive (${scannedPhotos.length} foto). Harap sesuaikan.`
      )
      document.getElementById('maxPhotos')?.focus()
      return
    }

    setIsScanningModalOpen(true)
    setScanProgress(30)
    setScanStatusText('Memproses galeri & sinkronisasi Google Drive...')

    try {
      let photos: DrivePhotoItem[] = scannedPhotos
      let detectedName = detectedFolderName

      // Jika belum sempat dipindai real-time, lakukan scan cepat dengan batas waktu maks 3.5 detik
      if (photos.length === 0 && cleanDriveLink) {
        try {
          const timeoutPromise = new Promise<{ success: boolean; photos: DrivePhotoItem[]; folderName?: string }>((resolve) =>
            setTimeout(() => resolve({ success: false, photos: [] }), 3500)
          )
          const result = await Promise.race([
            scanGoogleDriveFolder(cleanDriveLink),
            timeoutPromise,
          ])
          if (result && Array.isArray(result.photos) && result.photos.length > 0) {
            photos = result.photos
            if (result.folderName) {
              detectedName = result.folderName
              setClientName(result.folderName)
            }
          }
        } catch (_) {}
      }

      if (photos.length > 0 && parsedMaxPhotosInput > photos.length) {
        setIsScanningModalOpen(false)
        showToast(
          `Batas foto dipilih (${parsedMaxPhotosInput}) tidak boleh melebihi jumlah foto di Google Drive (${photos.length} foto). Harap sesuaikan.`
        )
        document.getElementById('maxPhotos')?.focus()
        return
      }

      setScanProgress(100)
      setScanStatusText('Menyimpan data galeri...')

      const finalClientName = clientName.trim() || detectedName.trim() || 'Klien Baru'
      const safeSlug =
        finalClientName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'klien'

      const newGalleryItem: GalleryData = {
        id: `gal-${Date.now()}`,
        clientName: finalClientName,
        date: new Date().toISOString().split('T')[0],
        maxPhotos: parsedMaxPhotosInput,
        selectedPhotos: 0,
        remainingDays: 0,
        status: 'Belum mulai',
        isClientViewed: false,
        whatsapp: clientWhatsapp,
        driveLink: cleanDriveLink,
        slug: safeSlug,
        shareToken: 'vtmsvc3urqfm',
        coverUrl: photos[0]?.url || '',
        selectedPhotoIds: [],
        photos,
        allowDownload,
      }

      // Simpan langsung ke storage dan update state seketika
      saveOrUpdateGallery(newGalleryItem)
      const freshGalleries = getStoredGalleries()
      setGalleries([...freshGalleries])

      setIsScanningModalOpen(false)
      openShareModalForGallery(newGalleryItem)

      if (photos.length > 0) {
        showToast(`Berhasil menyimpan galeri & memindai ${photos.length} foto dari Google Drive!`)
      } else {
        showToast(
          `Galeri "${finalClientName}" berhasil dibuat! (0 foto terdeteksi dari Drive. Anda dapat memindai ulang nanti di tombol Edit)`
        )
      }

      setCreateSuccessToast({
        clientName: finalClientName,
        photoCount: photos.length,
      })
      setTimeout(() => setCreateSuccessToast(null), 4500)

      handleResetCreateForm()
    } catch (err: any) {
      setIsScanningModalOpen(false)
      showToast(err?.message || 'Terjadi kesalahan saat memproses galeri.')
    }
  }

  // Pagination & Sorting logic (9 items per page, newest first)
  const ITEMS_PER_PAGE = 9
  const [currentPage, setCurrentPage] = useState(1)

  // Filter rentang waktu khusus tab "Selesai dipilih": 'all' | 'older_1_month'
  const [finishedTimeFilter, setFinishedTimeFilter] = useState<'all' | 'older_1_month'>('all')
  const [isDeleteOlderModalOpen, setIsDeleteOlderModalOpen] = useState(false)
  const [isDeletingOlder, setIsDeletingOlder] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterStatus, finishedTimeFilter])

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000

  const isGalleryOlderThanOneMonth = (g: GalleryData): boolean => {
    let timestamp = 0
    if (g.date) {
      const parsed = new Date(g.date).getTime()
      if (!isNaN(parsed) && parsed > 0) timestamp = parsed
    }
    if (!timestamp) {
      const match = g.id?.match(/gal-(\d+)/)
      if (match && match[1]) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num > 0) timestamp = num
      }
    }
    if (!timestamp) return false
    return Date.now() - timestamp >= ONE_MONTH_MS
  }

  const getGalleryTime = (g: GalleryData): number => {
    const match = g.id?.match(/gal-(\d+)/)
    if (match && match[1]) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num)) return num
    }
    if (g.date) {
      const t = new Date(g.date).getTime()
      if (!isNaN(t)) return t
    }
    return 0
  }

  // Sorted: Newest created galleries first
  const sortedGalleries = [...galleries].sort((a, b) => getGalleryTime(b) - getGalleryTime(a))

  // Filtered Galleries logic
  const filteredGalleries = sortedGalleries.filter((g) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery =
      !q ||
      (g.clientName || '').toLowerCase().includes(q) ||
      (g.slug || '').toLowerCase().includes(q) ||
      (g.whatsapp || '').includes(q)

    const clean = (s?: string) => (s || '').trim().toLowerCase()
    const matchesStatus =
      filterStatus === 'Semua' || clean(g.status) === clean(filterStatus)

    const matchesTime =
      filterStatus !== 'Selesai dipilih' ||
      finishedTimeFilter === 'all' ||
      isGalleryOlderThanOneMonth(g)

    return matchesQuery && matchesStatus && matchesTime
  })

  const totalPages = Math.ceil(filteredGalleries.length / ITEMS_PER_PAGE) || 1
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedGalleries = filteredGalleries.slice(startIndex, endIndex)

  const getPageNumbers = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, '...', total]
    }
    if (current >= total - 3) {
      return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    }
    return [1, '...', current - 1, current, current + 1, '...', total]
  }

  // Stats calculation
  const cleanStatus = (s?: string) => (s || '').trim().toLowerCase()
  const totalCount = galleries.length
  const selectingCount = galleries.filter(
    (g) => cleanStatus(g.status) === 'sedang memilih'
  ).length
  const finishedCount = galleries.filter(
    (g) => cleanStatus(g.status) === 'selesai dipilih'
  ).length
  const notStartedCount = galleries.filter(
    (g) => cleanStatus(g.status) === 'belum mulai'
  ).length
  const olderThanOneMonthFinishedCount = galleries.filter(
    (g) => cleanStatus(g.status) === 'selesai dipilih' && isGalleryOlderThanOneMonth(g)
  ).length

  const handleConfirmDeleteOlderGalleries = () => {
    const targetGalleries = galleries.filter(
      (g) => cleanStatus(g.status) === 'selesai dipilih' && isGalleryOlderThanOneMonth(g)
    )
    if (targetGalleries.length === 0) {
      setIsDeleteOlderModalOpen(false)
      return
    }

    setIsDeletingOlder(true)
    try {
      const targetIds = targetGalleries.map((g) => g.id)
      const updated = deleteMultipleGalleries(targetIds)
      setGalleries([...updated])
      showToast(`Berhasil menghapus ${targetGalleries.length} galeri (> 1 bulan).`)
      setIsDeleteOlderModalOpen(false)
      setFinishedTimeFilter('all')
    } catch (e: any) {
      console.error('Delete multiple galleries error:', e)
      showToast('Terjadi kesalahan saat menghapus galeri.')
    } finally {
      setIsDeletingOlder(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-stone-100 flex flex-col font-sans relative">
      {/* Grid Pattern Background Overlay (Kotak-kotak halus) */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(201, 162, 106, 0.035) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(201, 162, 106, 0.035) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* =========================================================================
          NAVBAR ATAS
          - Kiri: Placeholder Logo Livesostory
          - Kanan: Menu Beranda | Icon & Button Logout
      ========================================================================= */}
      <header
        className={`sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all duration-300 ${
          isScrolled
            ? 'bg-[#09090b]/85 backdrop-blur-xl border-b border-stone-800/90 shadow-md shadow-black/30'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        {/* Sisi Kiri: Branding Livesostory */}
        <div className="flex flex-col">
          <span className="font-extrabold text-base tracking-wider text-white">
            LIVESOSTORY.CO
          </span>
          <span className="text-[11px] text-stone-400 font-medium tracking-wide -mt-0.5">
            Admin Studio
          </span>
        </div>

        {/* Sisi Kanan: Menu Beranda | Icon & Button Logout */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#242220] border border-[#C9A26A]/40 text-[#C9A26A] font-semibold text-xs sm:text-sm">
            <Home className="h-4 w-4" />
            <span>Beranda</span>
          </div>

          <div className="h-4 w-px bg-stone-800" />

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-stone-300 hover:text-rose-400 hover:bg-rose-500/10 border border-stone-800 hover:border-rose-500/30 text-xs sm:text-sm font-medium transition-all cursor-pointer"
            title="Keluar dari akun admin"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* =========================================================================
          MAIN WORKSPACE CANVAS:
          GAMBAR 2: STATS CARDS (POSISI ATAS)
          GAMBAR 1: FORM CREATE (POSISI KIRI) | GAMBAR 3: KATALOG (POSISI KANAN)
      ========================================================================= */}
      <main className="relative z-10 p-4 sm:p-6 lg:p-7 max-w-[1720px] w-full mx-auto flex-1 space-y-6">
          {/* =========================================================================
              4 VIBRANT METRIC STAT CARDS
          ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Total Galeri */}
              <div
                onClick={() => setFilterStatus('Semua')}
                className={`bg-[#141312] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
                  filterStatus === 'Semua'
                    ? 'border-[#C9A26A]/70 ring-1 ring-[#C9A26A]/40'
                    : 'border-stone-800/90 hover:border-stone-700/80'
                }`}
                title="Tampilkan semua galeri"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      TOTAL GALERI
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {totalCount}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {totalCount} total galeri aktif
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-[#C9A26A]/10 text-[#C9A26A] border border-[#C9A26A]/25 flex items-center justify-center shadow-xs">
                    <FolderKanban className="h-5 w-5 stroke-[2.2]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-stone-800">
                  <div className="h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A26A] rounded-full w-full" />
                  </div>
                </div>
              </div>

              {/* Stat 2: Sedang Memilih */}
              <div
                onClick={() => setFilterStatus('Sedang memilih')}
                className={`bg-[#141312] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
                  filterStatus === 'Sedang memilih'
                    ? 'border-amber-500/70 ring-1 ring-amber-500/40'
                    : 'border-stone-800/90 hover:border-stone-700/80'
                }`}
                title="Filter galeri yang sedang memilih"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      SEDANG MEMILIH
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {selectingCount}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {selectingCount} dari {totalCount} galeri
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
                    <Clock className="h-5 w-5 stroke-[2.2]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-stone-800">
                  <div className="h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (selectingCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Stat 3: Selesai Dipilih */}
              <div
                onClick={() => setFilterStatus('Selesai dipilih')}
                className={`bg-[#141312] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
                  filterStatus === 'Selesai dipilih'
                    ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
                    : 'border-stone-800/90 hover:border-stone-700/80'
                }`}
                title="Filter galeri yang selesai dipilih"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      SELESAI DIPILIH
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {finishedCount}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {finishedCount} dari {totalCount} galeri
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-stone-800">
                  <div className="h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (finishedCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Stat 4: Belum Mulai */}
              <div
                onClick={() => setFilterStatus('Belum mulai')}
                className={`bg-[#141312] border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer ${
                  filterStatus === 'Belum mulai'
                    ? 'border-stone-500/70 ring-1 ring-stone-500/40'
                    : 'border-stone-800/90 hover:border-stone-700/80'
                }`}
                title="Filter galeri yang belum mulai"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                      BELUM MULAI
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {notStartedCount}
                    </p>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {notStartedCount} dari {totalCount} galeri
                    </p>
                  </div>
                  <div className="h-11 w-11 rounded-xl bg-stone-500/10 text-stone-400 border border-stone-700 flex items-center justify-center shadow-xs">
                    <AlertCircle className="h-5 w-5 stroke-[2.2]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-stone-800">
                  <div className="h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (notStartedCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-stone-600 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

        {/* =========================================================================
            2-COLUMN WORKSPACE:
            - SISI KIRI (GAMBAR 1): FORM BUAT GALERI BARU
            - SISI KANAN (GAMBAR 3): KATALOG GALERI
        ========================================================================= */}
        <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          {/* =========================================================================
              GAMBAR 1: FORM BUAT GALERI BARU & SINKRONISASI DRIVE (POSISI KIRI)
          ========================================================================= */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 lg:sticky lg:top-20">
            <div className="rounded-2xl border border-stone-800 bg-[#141312] text-white shadow-xl p-5 sm:p-6">
              {/* Form Header */}
              <div className="border-b border-stone-800 pb-4 mb-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#C9A26A]/15 text-[#C9A26A] border border-[#C9A26A]/30 flex items-center justify-center shrink-0">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Buat Galeri Baru & Sinkronisasi Drive
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Tempel tautan folder Google Drive untuk membaca foto dan menerbitkan link seleksi untuk klien.
                  </p>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. Link Folder Google Drive */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="driveLink"
                      className="text-xs font-semibold text-stone-200 flex items-center gap-2"
                    >
                      <span>1. Link Folder Google Drive</span>
                      <span className="text-[10px] text-rose-400 font-medium bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/40">
                        Wajib
                      </span>
                    </label>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="driveLink"
                      type="text"
                      required
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      placeholder="Tempel tautan folder Google Drive..."
                      className="w-full py-2.5 pl-3.5 pr-24 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A] bg-[#0e0d0c] border-stone-800 text-white placeholder-stone-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleScanLink()}
                      disabled={isScanningLink || !driveLink.trim()}
                      className="absolute right-1.5 px-3.5 py-1.5 rounded-md bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                    >
                      {isScanningLink ? 'Memindai...' : 'Pindai'}
                    </button>
                  </div>

                  {scanError && (
                    <div className="mt-2.5 rounded-lg border border-rose-800/60 bg-rose-950/40 text-rose-200 p-3 text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  {scannedPhotos.length > 0 && (
                    <div className="mt-3 rounded-lg border border-stone-800 bg-[#0e0d0c] text-stone-200 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#C9A26A]">
                          <CheckCircle2 className="h-4 w-4 text-[#C9A26A]" />
                          <span>Terdeteksi {scannedPhotos.length} Foto dari Google Drive!</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAllScannedModal(true)}
                          className="px-2.5 py-1 rounded bg-[#242220] text-stone-200 border border-stone-700 text-xs font-medium hover:bg-stone-800 cursor-pointer shadow-2xs"
                        >
                          Lihat Semua
                        </button>
                      </div>

                      {/* Photo preview strip */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
                        {scannedPhotos.slice(0, 6).map((ph, idx) => (
                          <div
                            key={ph.id || idx}
                            onClick={() => setPreviewLightboxPhoto(ph)}
                            className="aspect-square rounded-md border border-stone-800 overflow-hidden bg-[#141312] cursor-pointer hover:border-[#C9A26A]/50 hover:scale-105 transition-all"
                          >
                            <img
                              src={ph.thumbnailUrl || ph.url}
                              alt={ph.filename}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Nama Klien / Acara */}
                <div>
                  <div className="flex items-center mb-1.5">
                    <label
                      htmlFor="clientName"
                      className="text-xs font-semibold text-stone-200 flex items-center gap-2"
                    >
                      <span>2. Nama Klien / Acara</span>
                      <span className="text-[10px] text-rose-400 font-medium bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/40">
                        Wajib
                      </span>
                    </label>
                  </div>
                  <input
                    id="clientName"
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Masukkan Nama..."
                    className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A] bg-[#0e0d0c] border-stone-800 text-white placeholder-stone-500"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Otomatis mengikuti nama folder Google Drive yang dipindai (bisa disesuaikan manual).
                  </p>
                </div>

                {/* 3. Nomor WhatsApp & 4. Batas Maksimal Foto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center mb-1.5">
                      <label
                        htmlFor="clientWhatsapp"
                        className="text-xs font-semibold text-stone-200 flex items-center gap-2"
                      >
                        <span>3. Nomor WhatsApp Klien</span>
                        <span className="text-[10px] text-rose-400 font-medium bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-900/40">
                          Wajib
                        </span>
                      </label>
                    </div>
                    <input
                      id="clientWhatsapp"
                      type="tel"
                      required
                      value={clientWhatsapp}
                      onChange={handleWhatsappChange}
                      placeholder="Masukkan 08xxx..."
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A] bg-[#0e0d0c] border-stone-800 text-white placeholder-stone-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="maxPhotos"
                      className="block text-xs font-semibold text-stone-200 mb-1.5"
                    >
                      4. Batas Maksimal Foto Dipilih
                    </label>
                    <div className="relative" ref={maxPhotosContainerRef}>
                      <div
                        className={`flex items-center rounded-lg border bg-[#0e0d0c] transition-all focus-within:ring-1 overflow-hidden ${
                          scannedPhotos.length > 0 && Boolean(maxPhotos) && parseInt(maxPhotos) > scannedPhotos.length
                            ? 'border-rose-500 focus-within:ring-rose-500/20 focus-within:border-rose-500'
                            : 'border-stone-800 focus-within:ring-[#C9A26A]/30 focus-within:border-[#C9A26A]'
                        }`}
                      >
                        <input
                          id="maxPhotos"
                          type="number"
                          min={1}
                          max={scannedPhotos.length > 0 ? scannedPhotos.length : 5000}
                          value={maxPhotos}
                          onChange={(e) => setMaxPhotos(e.target.value)}
                          placeholder={scannedPhotos.length > 0 ? `Maks ${scannedPhotos.length}` : '...'}
                          className={`flex-1 py-2.5 px-3 text-xs sm:text-sm bg-transparent placeholder-stone-500 focus:outline-none ${
                            scannedPhotos.length > 0 && Boolean(maxPhotos) && parseInt(maxPhotos) > scannedPhotos.length
                              ? 'text-rose-400 font-semibold'
                              : 'text-white'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={toggleMaxPhotosDropdown}
                          className="px-3 py-2.5 text-stone-400 hover:text-white hover:bg-stone-800/80 border-l border-stone-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0"
                          title="Buka pilihan preset"
                        >
                          <span className="hidden sm:inline">Pilih</span>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isMaxPhotosDropdownOpen ? 'rotate-180 text-[#C9A26A]' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Info & Warning jika melebihi atau informasi jumlah foto di Drive */}
                      {scannedPhotos.length > 0 && Boolean(maxPhotos) && parseInt(maxPhotos) > scannedPhotos.length ? (
                        <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 font-medium leading-tight">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Jumlah tidak boleh melebihi foto di Drive ({scannedPhotos.length} foto).</span>
                        </p>
                      ) : scannedPhotos.length > 0 ? (
                        <p className="text-[11px] text-[#C9A26A] mt-1.5 font-medium leading-tight">
                          Tersedia: {scannedPhotos.length} foto
                        </p>
                      ) : null}

                      {/* Dropdown Menu Responsif */}
                      {isMaxPhotosDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setIsMaxPhotosDropdownOpen(false)}
                          />
                          <div
                            className={`absolute right-0 ${
                              dropdownPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                            } z-30 w-full sm:w-[260px] max-w-[calc(100vw-2.5rem)] max-h-56 overflow-y-auto rounded-xl border border-stone-800 bg-[#181716] shadow-2xl p-1.5 animate-in fade-in zoom-in-95`}
                          >
                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                              <span>Pilih Preset Cepat:</span>
                              {scannedPhotos.length > 0 && (
                                <span className="text-[#C9A26A] lowercase font-medium">({scannedPhotos.length} di drive)</span>
                              )}
                            </div>

                            {/* Opsi preset semua foto yang ada di Drive */}
                            {scannedPhotos.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMaxPhotos(String(scannedPhotos.length))
                                  setIsMaxPhotosDropdownOpen(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between mb-1 transition-colors cursor-pointer ${
                                  maxPhotos === String(scannedPhotos.length)
                                    ? 'bg-[#C9A26A] text-stone-950 font-bold'
                                    : 'bg-[#242220] text-[#C9A26A] hover:bg-[#2e2b29] border border-[#C9A26A]/30'
                                }`}
                              >
                                <span>Semua Foto ({scannedPhotos.length} Foto)</span>
                                {maxPhotos === String(scannedPhotos.length) && (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}

                            {[
                              { val: '20', label: '20 Foto' },
                              { val: '50', label: '50 Foto' },
                              { val: '60', label: '60 Foto' },
                              { val: '80', label: '80 Foto' },
                            ].map((item) => {
                              const isExceeded =
                                scannedPhotos.length > 0 && parseInt(item.val) > scannedPhotos.length
                              return (
                                <button
                                  key={item.val}
                                  type="button"
                                  disabled={isExceeded}
                                  onClick={() => {
                                    if (isExceeded) return
                                    setMaxPhotos(item.val)
                                    setIsMaxPhotosDropdownOpen(false)
                                  }}
                                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                    isExceeded
                                      ? 'opacity-40 cursor-not-allowed text-stone-500'
                                      : maxPhotos === item.val
                                      ? 'bg-[#C9A26A] text-stone-950 font-semibold cursor-pointer'
                                      : 'text-stone-200 hover:bg-[#242220] hover:text-white cursor-pointer'
                                  }`}
                                >
                                  <span>{item.label}</span>
                                  {isExceeded ? (
                                    <span className="text-[10px] text-rose-400">(Melebihi Drive)</span>
                                  ) : (
                                    maxPhotos === item.val && <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Checkbox Download */}
                <div className="p-3.5 rounded-lg border bg-[#0e0d0c] border-stone-800">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDownload}
                      onChange={(e) => setAllowDownload(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-700 bg-stone-900 text-[#C9A26A] accent-[#C9A26A] focus:ring-[#C9A26A] cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white">
                        Izinkan Klien Mengunduh Foto
                      </span>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Jika dinonaktifkan, klien hanya dapat melihat dan memilih foto tanpa tombol unduh.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={handleResetCreateForm}
                    className="px-4 py-2.5 rounded-lg border border-stone-800 text-stone-300 hover:bg-stone-900 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isScanningModalOpen}
                    className="px-5 py-2.5 rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] disabled:opacity-50 text-stone-950 text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <Check className="h-4 w-4 stroke-[2.5]" />
                    <span>Buat & Simpan Galeri</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* =========================================================================
              GAMBAR 3: KATALOG GALERI (POSISI KANAN)
          ========================================================================= */}
          <div className="w-full flex-1 min-w-0 space-y-4">

              {/* Search & Filter Bar */}
              <div className="p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#141312] border-stone-800">
                {/* Search Box */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama klien, slug, atau nomor WhatsApp..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A] bg-[#0e0d0c] border-stone-800 text-white placeholder-stone-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Status Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {(['Semua', 'Belum mulai', 'Sedang memilih', 'Selesai dipilih'] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFilterStatus(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                          filterStatus === st
                            ? 'bg-[#242220] border border-[#C9A26A]/40 text-[#C9A26A] shadow-xs'
                            : 'bg-[#0e0d0c] border border-stone-800/80 text-stone-400 hover:bg-stone-900 hover:text-stone-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Sub-bar Filter Waktu & Hapus Semua (Khusus Tab Selesai Dipilih) */}
              {filterStatus === 'Selesai dipilih' && (
                <div className="p-3 sm:px-4 sm:py-3 rounded-2xl border bg-[#141312] border-stone-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#C9A26A]" />
                      Rentang Waktu:
                    </span>
                    <button
                      type="button"
                      onClick={() => setFinishedTimeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        finishedTimeFilter === 'all'
                          ? 'bg-[#242220] border border-[#C9A26A]/40 text-[#C9A26A] shadow-xs font-bold'
                          : 'bg-[#0e0d0c] border border-stone-800 text-stone-300 hover:bg-stone-900 hover:text-white'
                      }`}
                    >
                      Semua Waktu ({finishedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinishedTimeFilter('older_1_month')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                        finishedTimeFilter === 'older_1_month'
                          ? 'bg-amber-600/30 border border-amber-500/50 text-amber-300 shadow-xs font-bold'
                          : 'bg-[#0e0d0c] border border-stone-800 text-amber-400/80 hover:bg-stone-900 hover:text-amber-300'
                      }`}
                    >
                      <span>&gt; 1 Bulan ({olderThanOneMonthFinishedCount})</span>
                    </button>
                  </div>

                  {/* Tombol Delete All jika filter > 1 bulan dipilih */}
                  {finishedTimeFilter === 'older_1_month' && (
                    <button
                      type="button"
                      onClick={() => setIsDeleteOlderModalOpen(true)}
                      disabled={olderThanOneMonthFinishedCount === 0}
                      className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      title={
                        olderThanOneMonthFinishedCount === 0
                          ? 'Tidak ada galeri yang lebih dari 1 bulan'
                          : `Hapus semua ${olderThanOneMonthFinishedCount} galeri yang lebih dari 1 bulan`
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus Semua ({olderThanOneMonthFinishedCount})</span>
                    </button>
                  )}
                </div>
              )}

              {/* Gallery Cards Grid */}
              {filteredGalleries.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border bg-[#141312] border-stone-800">
                  <div className="h-12 w-12 rounded-full bg-[#C9A26A]/10 text-[#C9A26A] border border-[#C9A26A]/20 mx-auto flex items-center justify-center mb-3">
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Tidak Ada Galeri yang Cocok
                  </h3>
                  <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `Tidak ditemukan galeri dengan kata kunci "${searchQuery}". Coba kata pencarian lain.`
                      : 'Belum ada galeri foto yang dibuat.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterStatus('Semua')
                      const el = document.getElementById('driveLink')
                      el?.focus()
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className="mt-4 bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    + Buat Galeri Baru
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {paginatedGalleries.map((gallery) => {
                    const selectedCount = gallery.selectedPhotos || 0
                    const maxP = gallery.maxPhotos || 60
                    const progressPercent = Math.min(100, Math.round((selectedCount / maxP) * 100))

                    return (
                      <div
                        key={gallery.id}
                        className="rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden bg-[#141312] border-stone-800 hover:border-[#C9A26A]/40 shadow-xs"
                      >
                        <div className="p-5 space-y-4">
                          {/* Client Info & Cover */}
                          <div className="flex gap-3.5 items-start">
                            <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-stone-800 bg-[#0e0d0c]">
                              {gallery.coverUrl ? (
                                <img
                                  src={gallery.coverUrl}
                                  alt={gallery.clientName}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-stone-500 text-xs">
                                  No Photo
                                </div>
                              )}
                              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] text-center font-medium py-0.5 backdrop-blur-xs">
                                {gallery.photos?.length || 0} FOTO
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-base text-white truncate">
                                {gallery.clientName}
                              </h4>
                              <p className="text-xs text-stone-400 mt-1 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                                <span>{gallery.date || 'Tanpa Tanggal'}</span>
                              </p>
                              <p className="text-xs text-stone-400 flex items-center gap-1.5 truncate mt-0.5">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                                <span>{gallery.whatsapp || '-'}</span>
                              </p>

                              {/* Status Badge & View Count */}
                              <div className="mt-2.5 flex items-center gap-1.5 flex-nowrap">
                                <span
                                  className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap shrink-0 ${
                                    gallery.status === 'Selesai dipilih'
                                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                                      : gallery.status === 'Sedang memilih'
                                      ? 'bg-amber-950/40 text-amber-300 border border-amber-800'
                                      : 'bg-stone-800 text-stone-300 border border-stone-700'
                                  }`}
                                >
                                  {gallery.status}
                                </span>

                                <span
                                  className="inline-flex items-center justify-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-stone-800/90 text-stone-300 border border-stone-700 whitespace-nowrap shrink-0"
                                  title="Jumlah kali galeri ini telah dibuka oleh klien"
                                >
                                  <Eye className="h-3 w-3 text-stone-400 shrink-0" />
                                  <span>Dibuka {gallery.viewCount || (gallery.isClientViewed ? 1 : 0)}x</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Meter */}
                          <div className="p-3 rounded-lg border bg-[#0e0d0c] border-stone-800">
                            <div className="flex items-center justify-between text-xs text-stone-300 mb-1.5">
                              <span className="font-medium">Foto Dipilih:</span>
                              <span className="font-bold text-white">
                                {selectedCount} / {maxP} ({progressPercent}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-stone-800 overflow-hidden">
                              <div
                                style={{ width: `${progressPercent}%` }}
                                className="h-full bg-[#C9A26A] rounded-full transition-all duration-300"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-stone-400 mt-2">
                              <span>Tanpa batas waktu</span>
                              <span>{gallery.allowDownload ? 'Download ON' : 'Download OFF'}</span>
                            </div>
                          </div>

                          {/* Tombol Lihat Foto Pilihan Klien */}
                          {selectedCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setViewingSelectedGallery(gallery)}
                              className="w-full py-2 px-3 rounded-lg bg-[#242220] hover:bg-[#2d2a27] text-[#C9A26A] border border-[#C9A26A]/40 font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>Lihat {selectedCount} Foto Pilihan Klien</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="w-full py-2 px-3 rounded-lg bg-stone-900/40 border border-stone-800 text-stone-500 font-medium text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                            >
                              <CheckCircle2 className="h-4 w-4 opacity-40" />
                              <span>Belum Ada Foto Dipilih Klien</span>
                            </button>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-1 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => openShareModalForGallery(gallery)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="truncate">Bagikan WA</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDriveFolder(gallery)}
                              className="border border-stone-800 bg-[#1c1a19] hover:bg-[#252220] text-stone-200 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Folder className="h-3.5 w-3.5" />
                              <span className="truncate">Buka Drive</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(gallery)}
                              className="border border-stone-800 bg-[#1c1a19] hover:bg-[#252220] text-stone-200 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer hover:text-[#C9A26A]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setGalleryToDelete(gallery)}
                              className="border border-rose-900/40 bg-[#1c1a19] hover:bg-rose-950/30 text-rose-400 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>

                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 rounded-2xl border border-stone-800 bg-[#141312] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs shadow-xs">
                  <div className="text-stone-400">
                    Menampilkan <strong className="text-white">{startIndex + 1}</strong> -{' '}
                    <strong className="text-white">{Math.min(endIndex, filteredGalleries.length)}</strong> dari{' '}
                    <strong className="text-white">{filteredGalleries.length}</strong> galeri
                    <span className="text-stone-500 ml-1.5">(9 per halaman)</span>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                          window.scrollTo({ top: 380, behavior: 'smooth' })
                        }}
                        disabled={safeCurrentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-stone-800 bg-[#0e0d0c] text-stone-300 hover:text-white hover:bg-[#242220] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                        title="Halaman Sebelumnya"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Sebelumnya</span>
                      </button>

                      {getPageNumbers(safeCurrentPage, totalPages).map((p, idx) =>
                        p === '...' ? (
                          <span key={`dots-${idx}`} className="px-1 text-stone-500">
                            ...
                          </span>
                        ) : (
                          <button
                            key={`page-${p}`}
                            type="button"
                            onClick={() => {
                              setCurrentPage(Number(p))
                              window.scrollTo({ top: 380, behavior: 'smooth' })
                            }}
                            className={`h-8 w-8 rounded-lg font-bold transition-colors cursor-pointer text-xs ${
                              safeCurrentPage === p
                                ? 'bg-[#C9A26A] text-stone-950 shadow-xs'
                                : 'border border-stone-800 bg-[#0e0d0c] text-stone-300 hover:bg-[#242220] hover:text-white'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          window.scrollTo({ top: 380, behavior: 'smooth' })
                        }}
                        disabled={safeCurrentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-stone-800 bg-[#0e0d0c] text-stone-300 hover:text-white hover:bg-[#242220] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                        title="Halaman Berikutnya"
                      >
                        <span className="hidden sm:inline">Berikutnya</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        </main>

      {/* =========================================================================
          MODALS & OVERLAYS (CLEAN MODERN CMS STYLE)
      ========================================================================= */}

      {/* 1. Share Ready Modal (WhatsApp Message) */}
      {isShareModalOpen && shareModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl bg-[#141312] border-stone-800 text-white">
            {/* Header */}
            <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#C9A26A]/15 text-[#C9A26A] border border-[#C9A26A]/30 flex items-center justify-center">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Bagikan Link Galeri</h3>
                  <p className="text-xs text-stone-400">Kirim undangan kurasi foto via WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-[#242220] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-stone-300">
                Penerima: <span className="font-semibold text-white">{shareModalData.clientName}</span> ({shareModalData.whatsapp})
              </div>

              {/* Big WhatsApp Send Button */}
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
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 px-4 shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Phone className="h-4 w-4" />
                <span>Buka Chat WhatsApp Sekarang</span>
              </button>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-stone-400">
                  <span>Pratinjau Pesan:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareModalData.fullMessage)
                      setCopySuccessToast('Teks pesan WhatsApp berhasil disalin ke clipboard.')
                      showToast('Teks pesan berhasil disalin!')
                    }}
                    className="text-xs text-[#C9A26A] hover:underline font-semibold cursor-pointer"
                  >
                    Salin Teks
                  </button>
                </div>
                <textarea
                  readOnly
                  value={shareModalData.fullMessage}
                  rows={9}
                  className="w-full rounded-xl border border-stone-800 p-3 text-xs font-mono bg-[#0e0d0c] text-stone-200 focus:outline-none select-all leading-relaxed"
                />
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={shareModalData.selectionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[#C9A26A]/30 bg-[#242220] hover:bg-[#2d2a27] text-[#C9A26A] text-center py-2 text-xs font-semibold transition-colors"
                >
                  Buka Link Seleksi
                </a>
                <a
                  href={shareModalData.albumLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-stone-800 bg-[#1c1a19] hover:bg-[#242220] text-stone-300 text-center py-2 text-xs font-semibold transition-colors"
                >
                  Buka Link Album
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Edit Galeri */}
      {editingGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-800 bg-[#141312] text-white shadow-2xl my-8">
            {/* Header */}
            <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Edit Galeri</h3>
                <p className="text-xs text-stone-400">{editingGallery.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryToEdit(null)}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-[#242220] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nama Klien / Acara
                  </label>
                  <input
                    type="text"
                    required
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    placeholder="Contoh: Wedding Sarah & Kevin"
                    className="w-full rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Nomor WhatsApp Klien
                  </label>
                  <input
                    type="tel"
                    required
                    value={editWhatsapp}
                    onChange={handleEditWhatsappChange}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Slug URL
                  </label>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="contoh: wedding-sarah-kevin"
                    className="w-full rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                    Status Pemilihan
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(
                        e.target.value as
                          | 'Belum mulai'
                          | 'Sedang memilih'
                          | 'Selesai dipilih'
                      )
                    }
                    className="w-full rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                  >
                    <option value="Belum mulai">Belum mulai</option>
                    <option value="Sedang memilih">Sedang memilih</option>
                    <option value="Selesai dipilih">Selesai dipilih</option>
                  </select>
                </div>
              </div>

              <div>
                {(() => {
                  const editAvailablePhotosCount = (
                    editNewScannedPhotos && editNewScannedPhotos.length > 0
                      ? editNewScannedPhotos
                      : editingGallery.photos
                  )?.length || 0
                  const isEditExceeded =
                    editAvailablePhotosCount > 0 &&
                    Boolean(editMaxPhotos) &&
                    parseInt(editMaxPhotos) > editAvailablePhotosCount

                  return (
                    <>
                      <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                        Batas Maksimal Foto Dipilih
                      </label>
                      <div className="relative" ref={editMaxPhotosContainerRef}>
                        <div
                          className={`flex items-center rounded-lg border bg-[#0e0d0c] transition-all focus-within:ring-1 overflow-hidden ${
                            isEditExceeded
                              ? 'border-rose-500 focus-within:ring-rose-500/20 focus-within:border-rose-500'
                              : 'border-stone-800 focus-within:ring-[#C9A26A]/30 focus-within:border-[#C9A26A]'
                          }`}
                        >
                          <input
                            type="number"
                            min={1}
                            max={editAvailablePhotosCount > 0 ? editAvailablePhotosCount : 5000}
                            value={editMaxPhotos}
                            onChange={(e) => setEditMaxPhotos(e.target.value)}
                            placeholder="60"
                            className={`flex-1 p-2.5 text-xs bg-transparent focus:outline-none ${
                              isEditExceeded
                                ? 'text-rose-500 font-semibold'
                                : 'text-white'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={toggleEditMaxPhotosDropdown}
                            className="px-3 py-2.5 text-stone-400 hover:text-white hover:bg-stone-800 border-l border-stone-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shrink-0"
                            title="Buka pilihan preset"
                          >
                            <span className="hidden sm:inline">Pilih</span>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isEditMaxPhotosDropdownOpen ? 'rotate-180 text-[#C9A26A]' : ''
                              }`}
                            />
                          </button>
                        </div>

                        {/* Dropdown Menu Responsif */}
                        {isEditMaxPhotosDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setIsEditMaxPhotosDropdownOpen(false)}
                            />
                            <div
                              className={`absolute right-0 ${
                                editDropdownPlacement === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                              } z-30 w-full sm:w-[260px] max-w-[calc(100vw-2.5rem)] max-h-56 overflow-y-auto rounded-xl border border-stone-800 bg-[#181716] shadow-2xl p-1.5 animate-in fade-in zoom-in-95`}
                            >
                              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                                <span>Pilih Preset Cepat:</span>
                                {editAvailablePhotosCount > 0 && (
                                  <span className="text-[#C9A26A] lowercase font-medium">({editAvailablePhotosCount} di drive)</span>
                                )}
                              </div>

                              {/* Opsi preset semua foto yang ada di Drive */}
                              {editAvailablePhotosCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMaxPhotos(String(editAvailablePhotosCount))
                                    setIsEditMaxPhotosDropdownOpen(false)
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between mb-1 transition-colors cursor-pointer ${
                                    editMaxPhotos === String(editAvailablePhotosCount)
                                      ? 'bg-[#C9A26A] text-stone-950 font-bold'
                                      : 'bg-[#242220] text-[#C9A26A] hover:bg-[#2e2b29] border border-[#C9A26A]/30'
                                  }`}
                                >
                                  <span>Semua Foto ({editAvailablePhotosCount} Foto)</span>
                                  {editMaxPhotos === String(editAvailablePhotosCount) && (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}

                              {[
                                { val: '10', label: '10 Foto' },
                                { val: '30', label: '30 Foto' },
                                { val: '50', label: '50 Foto' },
                                { val: '60', label: '60 Foto' },
                              ].map((item) => {
                                const isPresExceeded =
                                  editAvailablePhotosCount > 0 &&
                                  parseInt(item.val) > editAvailablePhotosCount
                                return (
                                  <button
                                    key={item.val}
                                    type="button"
                                    disabled={isPresExceeded}
                                    onClick={() => {
                                      if (isPresExceeded) return
                                      setEditMaxPhotos(item.val)
                                      setIsEditMaxPhotosDropdownOpen(false)
                                    }}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                      isPresExceeded
                                        ? 'opacity-40 cursor-not-allowed text-stone-500'
                                        : editMaxPhotos === item.val
                                        ? 'bg-[#C9A26A] text-stone-950 font-semibold cursor-pointer'
                                        : 'text-stone-200 hover:bg-[#242220] hover:text-white cursor-pointer'
                                    }`}
                                  >
                                    <span>{item.label}</span>
                                    {isPresExceeded ? (
                                      <span className="text-[10px] text-rose-500">(Melebihi Foto)</span>
                                    ) : (
                                      editMaxPhotos === item.val && <Check className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  Link Folder Google Drive
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editDriveLink}
                    onChange={(e) => setEditDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                  />
                  <button
                    type="button"
                    onClick={handleEditRescanDrive}
                    disabled={isEditScanning}
                    className="rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isEditScanning ? 'Memindai...' : 'Pindai Ulang'}
                  </button>
                </div>
                {editScanError && (
                  <p className="text-[11px] font-medium text-rose-400 mt-1">
                    {editScanError}
                  </p>
                )}
                {editScanSuccessMsg && (
                  <p className="text-[11px] font-medium text-emerald-400 mt-1">
                    {editScanSuccessMsg}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                  PIN Keamanan Album (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={editPinCode}
                  onChange={(e) => setEditPinCode(e.target.value)}
                  placeholder="Contoh: 1234 (4-8 digit angka)"
                  className="w-full rounded-lg border border-stone-800 p-2.5 text-xs text-white bg-[#0e0d0c] focus:outline-none focus:ring-1 focus:ring-[#C9A26A]/30 focus:border-[#C9A26A]"
                />
              </div>

              <div className="border-t border-stone-800 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setGalleryToEdit(null)}
                  className="rounded-lg bg-[#242220] hover:bg-[#2d2a27] text-stone-300 border border-stone-800 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 font-bold px-5 py-2 text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal Konfirmasi Hapus Galeri */}
      {galleryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#141312] text-white p-6 shadow-2xl">
            <div className="h-10 w-10 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-900/40 flex items-center justify-center font-bold text-lg mb-3">
              ⚠️
            </div>
            <h3 className="text-sm font-bold text-white">
              Hapus Galeri &ldquo;{galleryToDelete.clientName}&rdquo;?
            </h3>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Tindakan ini tidak bisa dibatalkan. Seluruh data konfigurasi dan riwayat pemilihan foto klien akan dihapus secara permanen.
            </p>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-stone-800 pt-4">
              <button
                type="button"
                onClick={() => setGalleryToDelete(null)}
                className="rounded-lg bg-[#242220] hover:bg-[#2d2a27] text-stone-300 border border-stone-800 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteGallery(galleryToDelete)}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3b. Modal Konfirmasi Hapus Semua Galeri Selesai > 1 Bulan */}
      {isDeleteOlderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-[#141312] text-white p-6 shadow-2xl">
            <div className="h-10 w-10 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-900/40 flex items-center justify-center font-bold text-lg mb-3">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Hapus Semua Galeri Selesai (&gt; 1 Bulan)?
            </h3>
            <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">
              Anda akan menghapus permanen <strong className="text-rose-400 font-bold">{olderThanOneMonthFinishedCount} galeri</strong> berstatus &ldquo;Selesai dipilih&rdquo; yang berumur lebih dari 1 bulan. Seluruh foto pilihan dan konfigurasi album ini akan dihapus secara permanen.
            </p>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-stone-800 pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteOlderModalOpen(false)}
                disabled={isDeletingOlder}
                className="rounded-lg bg-[#242220] hover:bg-[#2d2a27] text-stone-300 border border-stone-800 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOlderGalleries}
                disabled={isDeletingOlder || olderThanOneMonthFinishedCount === 0}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingOlder ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Ya, Hapus {olderThanOneMonthFinishedCount} Galeri</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Scanning Modal (Proses Baca Drive) */}
      {isScanningModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-stone-800 bg-[#141312] text-white p-6 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-[#C9A26A]/15 text-[#C9A26A] border border-[#C9A26A]/30 mx-auto flex items-center justify-center">
              <Folder className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Memindai Google Drive...
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                {scanStatusText}
              </p>
            </div>

            <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
              <div
                style={{ width: `${scanProgress}%` }}
                className="h-full bg-[#C9A26A] rounded-full transition-all duration-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Lightbox Preview Photo */}
      {previewLightboxPhoto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setPreviewLightboxPhoto(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl border border-stone-800 bg-[#141312] p-3 shadow-2xl max-w-4xl max-h-[90vh] flex flex-col items-center animate-in fade-in zoom-in-95"
          >
            <div className="w-full pb-2 mb-2 flex justify-between items-center text-xs text-stone-300">
              <span className="font-medium truncate max-w-xs">{previewLightboxPhoto.filename}</span>
              <button
                type="button"
                onClick={() => setPreviewLightboxPhoto(null)}
                className="p-1 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewLightboxPhoto.url || previewLightboxPhoto.thumbnailUrl}
              alt={previewLightboxPhoto.filename}
              className="max-h-[75vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}

      {/* 6. All Scanned Photos Modal */}
      {showAllScannedModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
          onClick={() => setShowAllScannedModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl h-[85vh] rounded-2xl border border-stone-800 bg-[#141312] text-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto"
          >
            {/* Modal Header */}
            <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between shrink-0 bg-[#181716]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#C9A26A]/15 text-[#C9A26A] border border-[#C9A26A]/30 flex items-center justify-center text-sm">
                  📸
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                    <span>Semua Foto Terdeteksi</span>
                    <span className="text-xs bg-[#C9A26A]/15 text-[#C9A26A] border border-[#C9A26A]/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {scannedPhotos.length} Foto
                    </span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Klik foto mana saja untuk melihat pratinjau resolusi penuh.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Photo Grid */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {scannedPhotos.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    onClick={() => setPreviewLightboxPhoto(p)}
                    className="group relative w-full aspect-square rounded-xl border border-stone-800 bg-[#0e0d0c] overflow-hidden cursor-pointer shadow-xs hover:border-[#C9A26A] hover:shadow-lg transition-all duration-200"
                  >
                    <img
                      src={p.thumbnailUrl || p.url}
                      alt={p.filename}
                      loading="lazy"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-[11px] text-white">
                      <span className="truncate max-w-[78%] font-medium text-[10px]">
                        {p.filename}
                      </span>
                      <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono text-stone-200">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-stone-800 px-6 py-3.5 bg-[#181716] flex items-center justify-between text-xs text-stone-400 shrink-0">
              <span>
                Total <strong>{scannedPhotos.length}</strong> foto terindeks dari folder Google Drive
              </span>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Lihat Foto Pilihan Klien (Admin) */}
      {viewingSelectedGallery && (() => {
        const selectedPhotos = (viewingSelectedGallery.photos || []).filter(
          (p) => p && (viewingSelectedGallery.selectedPhotoIds || []).includes(p.id)
        )

        return (
          <div
            className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
            onClick={() => setViewingSelectedGallery(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-6xl h-[85vh] rounded-2xl border border-stone-800 bg-[#141312] text-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto"
            >
              {/* Modal Header */}
              <div className="border-b border-stone-800 px-6 py-4 flex items-center justify-between shrink-0 bg-[#181716]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#C9A26A]/15 border border-[#C9A26A]/30 text-[#C9A26A] flex items-center justify-center font-bold">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-white">
                        Foto Pilihan Klien — {viewingSelectedGallery.clientName}
                      </h3>
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                        {viewingSelectedGallery.selectedPhotos || 0} Terpilih
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>Total Koleksi: <strong className="text-stone-200">{viewingSelectedGallery.photos?.length || 0}</strong> foto</span>
                      <span>•</span>
                      <span>Batas Maks: {viewingSelectedGallery.maxPhotos} foto</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-[#C9A26A]">
                        <Eye className="h-3 w-3" />
                        <span>Dibuka {viewingSelectedGallery.viewCount || (viewingSelectedGallery.isClientViewed ? 1 : 0)}x</span>
                      </span>
                      <span>•</span>
                      <span>Status: <strong className="text-stone-200">{viewingSelectedGallery.status}</strong></span>
                      {viewingSelectedGallery.whatsapp && (
                        <>
                          <span>•</span>
                          <span>WA: {viewingSelectedGallery.whatsapp}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingSelectedGallery(null)}
                  className="text-stone-400 hover:text-white p-2 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body: Split Kiri (Foto Preview) & Kanan (Daftar Foto Terpilih) */}
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                {selectedPhotos.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-12 text-center">
                    <div>
                      <div className="h-14 w-14 rounded-full bg-stone-800 text-stone-400 mx-auto flex items-center justify-center mb-3">
                        <CheckCircle2 className="h-7 w-7 opacity-40 text-stone-500" />
                      </div>
                      <h4 className="text-base font-bold text-white">Belum Ada Foto Dipilih</h4>
                      <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                        Klien belum menandai foto favorit di galeri ini. Tautan seleksi telah aktif dan siap digunakan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* SISI KIRI: Grid Foto yang Telah Dipilih Klien */}
                    <div className="flex-1 p-5 overflow-y-auto min-w-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                        {selectedPhotos.map((photo, idx) => (
                          <div
                            key={photo.id || idx}
                            onClick={() => setSelectedLightboxPhoto(photo)}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-stone-800 bg-[#0e0d0c] cursor-pointer hover:border-[#C9A26A] transition-all hover:scale-[1.02] shadow-sm"
                          >
                            <img
                              src={photo.thumbnailUrl || photo.url}
                              alt={photo.filename}
                              loading="lazy"
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {/* Number badge */}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-bold text-[#C9A26A] border border-[#C9A26A]/40">
                              #{idx + 1}
                            </div>
                            {/* Check badge */}
                            <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                            {/* Filename footer */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2.5 pt-6">
                              <p className="text-[11px] font-medium text-white truncate">
                                {photo.filename}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SISI KANAN: Daftar Foto Terpilih */}
                    <div className="w-full lg:w-[360px] xl:w-[400px] shrink-0 border-t lg:border-t-0 lg:border-l border-stone-800 bg-[#11100f] p-5 flex flex-col overflow-hidden">
                      {/* Header & Tombol Salin */}
                      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                        <span className="text-xs sm:text-sm font-semibold text-stone-200">
                          Daftar foto terpilih ({selectedPhotos.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const text = selectedPhotos.map((p) => p.filename || `Foto-${p.id}`).join('\n')
                            navigator.clipboard.writeText(text)
                            setIsCopiedAll(true)
                            setTimeout(() => setIsCopiedAll(false), 2000)
                            setCopySuccessToast(`${selectedPhotos.length} nama file foto terpilih berhasil disalin ke clipboard.`)
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                          title="Salin semua nama file"
                        >
                          {isCopiedAll ? (
                            <>
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Salin Semua ({selectedPhotos.length})</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Box Berisi Daftar Nama File */}
                      <div className="flex-1 min-h-[160px] rounded-xl border border-stone-800 bg-[#0a0a09] p-3.5 flex flex-col overflow-hidden">
                        <textarea
                          readOnly
                          value={selectedPhotos.map((p) => p.filename || `Foto-${p.id}`).join('\n')}
                          className="w-full flex-1 font-mono text-xs sm:text-sm text-stone-200 bg-transparent resize-none focus:outline-none select-all leading-relaxed"
                          placeholder="Belum ada foto yang dipilih..."
                        />
                      </div>

                      {/* Tombol Unduh Semua Foto Terpilih sebagai ZIP */}
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadSelectedAsZip(selectedPhotos, viewingSelectedGallery.clientName)
                        }
                        disabled={isZipping || selectedPhotos.length === 0}
                        className="mt-3.5 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 cursor-pointer"
                        title="Unduh seluruh foto terpilih ke satu file ZIP"
                      >
                        {isZipping ? (
                          <>
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            <span className="truncate">{zipProgressText || 'Memproses ZIP...'}</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            <span>Unduh Semua Foto Terpilih ({selectedPhotos.length}) (.ZIP)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-stone-800 px-6 py-3.5 bg-[#181716] flex items-center justify-between text-xs text-stone-400 shrink-0">
                <span>
                  Ketuk foto manapun untuk melihat dalam resolusi penuh
                </span>
                <button
                  type="button"
                  onClick={() => setViewingSelectedGallery(null)}
                  className="px-4 py-1.5 rounded-lg bg-[#C9A26A] hover:bg-[#ba965c] text-stone-950 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Lightbox for Selected Photo */}
      {selectedLightboxPhoto && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setSelectedLightboxPhoto(null)}
        >
          {/* Top Right Controls: Share, Download, Close */}
          <div
            className="absolute top-4 right-4 flex items-center gap-2.5 sm:gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleShareSelectedPhoto(selectedLightboxPhoto)}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
              title="Bagikan Foto"
            >
              <Share2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </button>

            <button
              type="button"
              onClick={() => handleDownloadSelectedPhoto(selectedLightboxPhoto)}
              disabled={isDownloadingPhoto}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg disabled:opacity-50"
              title="Unduh Foto"
            >
              {isDownloadingPhoto ? (
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Download className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedLightboxPhoto(null)}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer backdrop-blur-md border border-white/10 shadow-lg"
              title="Tutup"
            >
              <X className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </button>
          </div>
          <div
            className="max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedLightboxPhoto.url || selectedLightboxPhoto.thumbnailUrl}
              alt={selectedLightboxPhoto.filename}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-center">
              <p className="text-sm font-semibold text-white">
                {selectedLightboxPhoto.filename}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Notifikasi Berhasil Login (Sisi Kanan Atas - Style Default Tailwind) */}
      {loginSuccessToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 w-full max-w-sm p-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="inline-flex items-center justify-center shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-900/40 dark:text-green-300">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">Berhasil Login!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Selamat datang kembali di Dashboard.</p>
          </div>
          <button
            type="button"
            onClick={() => setLoginSuccessToast(false)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notifikasi Berhasil Menambahkan Data Galeri (Sisi Kanan Atas - Style Default Tailwind) */}
      {createSuccessToast && (
        <div className="fixed top-5 right-5 z-[80] flex items-center gap-3 w-full max-w-sm p-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="inline-flex items-center justify-center shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-900/40 dark:text-green-300">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">Galeri Berhasil Dibuat!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Galeri "{createSuccessToast.clientName}" berhasil disimpan ({createSuccessToast.photoCount} foto disinkronkan).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateSuccessToast(null)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Notifikasi Berhasil Salin (Sisi Kanan Atas - Style Default Tailwind) */}
      {copySuccessToast && (
        <div className="fixed top-5 right-5 z-[80] flex items-center gap-3 w-full max-w-sm p-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="inline-flex items-center justify-center shrink-0 w-8 h-8 text-green-500 bg-green-100 rounded-lg dark:bg-green-900/40 dark:text-green-300">
            <Check className="w-5 h-5" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white">Berhasil Disalin!</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{copySuccessToast}</p>
          </div>
          <button
            type="button"
            onClick={() => setCopySuccessToast(null)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-[#1c1a19] text-stone-200 px-4 py-3 shadow-xl flex items-center gap-2.5 text-xs font-medium border border-stone-800 animate-in fade-in slide-in-from-bottom-2">
          <div className="h-2 w-2 rounded-full bg-[#C9A26A] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
