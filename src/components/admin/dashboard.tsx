import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  Check,
  CheckCircle2,
  PlusCircle,
  Pencil,
  Trash2,
  Eye,
  AlertCircle,
  FolderKanban,
  BarChart3,
  Menu,
  Search,
  ExternalLink,
  Share2,
  Folder,
  Calendar,
  Phone,
  Clock,
  X,
  ChevronDown,
} from 'lucide-react'
import { signOutAdmin, supabase, ADMIN_EMAIL } from '../../lib/supabase.ts'
import {
  getStoredGalleries,
  saveOrUpdateGallery,
  updateGallery,
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
  const [adminEmail, setAdminEmail] = useState<string>(ADMIN_EMAIL)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'galleries' | 'analytics'>('galleries')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'Semua' | 'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih'>('Semua')

  // Permanent dark theme for Admin Dashboard
  const isDarkMode = true
  useEffect(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem('livein-theme', 'dark')
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setAdminEmail(user.email)
      }
    })
  }, [])

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
  const [maxPhotos, setMaxPhotos] = useState('')
  const [selectionDeadline, setSelectionDeadline] = useState('30 hari')
  const [clientName, setClientName] = useState('')
  const [eventDate, setEventDate] = useState('')
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

  // Edit Gallery Modal State & Handlers
  const [editingGallery, setGalleryToEdit] = useState<GalleryData | null>(null)
  const [editClientName, setEditClientName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editEventDate, setEditEventDate] = useState('')
  const [editMaxPhotos, setEditMaxPhotos] = useState('60')
  const [editRemainingDays, setEditRemainingDays] = useState('30')
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
    setEditEventDate(gallery.date || '')
    setEditMaxPhotos(String(gallery.maxPhotos || 60))
    setEditRemainingDays(String(gallery.remainingDays || 30))
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
      const res = await scanGoogleDriveFolder(url, editClientName)
      setIsEditScanning(false)
      if (res.success && res.photos && res.photos.length > 0) {
        setEditNewScannedPhotos(res.photos)
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
      date: editEventDate || editingGallery.date,
      maxPhotos: parseInt(editMaxPhotos) || editingGallery.maxPhotos,
      remainingDays: parseInt(editRemainingDays) || editingGallery.remainingDays,
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
    navigate('/login')
  }

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  const handleWhatsappChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = e.target.value.replace(/\D/g, '')
    setClientWhatsapp(sanitized)
  }

  // Reset seluruh input form pembuatan galeri ke kondisi awal
  const handleResetCreateForm = () => {
    setDriveLink('')
    setMaxPhotos('')
    setSelectionDeadline('30 hari')
    setClientName('')
    setEventDate('')
    setClientEmail('')
    setClientWhatsapp('')
    setAllowDownload(true)
    setScannedPhotos([])
    setIsScanningLink(false)
    setScanResultSource('')
    setScanError(null)
    setDetectedFolderName('')
  }

  // Tutup modal dan reset data form otomatis
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    handleResetCreateForm()
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
        selectedPhotoIds: [],
        photos: driveResult.photos,
        allowDownload,
      }

      saveOrUpdateGallery(newGalleryItem)
      setGalleries(getStoredGalleries())

      // Buka modal "Galeri siap dikirim"
      openShareModalForGallery(newGalleryItem)
      showToast(
        `Berhasil memindai ${driveResult.photos.length} foto langsung dari Google Drive!`
      )

      // Reset form dan tutup popup buat galeri
      handleResetCreateForm()
      setIsCreateModalOpen(false)
      setActiveTab('galleries')
    }, 3200)
  }

  // Filtered Galleries logic
  const filteredGalleries = galleries.filter((g) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesQuery =
      !q ||
      (g.clientName || '').toLowerCase().includes(q) ||
      (g.slug || '').toLowerCase().includes(q) ||
      (g.whatsapp || '').includes(q)

    const matchesStatus =
      filterStatus === 'Semua' || g.status === filterStatus

    return matchesQuery && matchesStatus
  })

  // Stats calculation
  const totalCount = galleries.length
  const selectingCount = galleries.filter((g) => g.status === 'Sedang memilih').length
  const finishedCount = galleries.filter((g) => g.status === 'Selesai dipilih').length
  const viewedCount = galleries.filter((g) => g.isClientViewed).length

  return (
    <div className="min-h-screen flex font-sans bg-[#0B0F19] text-[#F3F4F6]">
      {/* =========================================================================
          LEFT SIDEBAR: MODERN ENTERPRISE CMS NAVIGATION
      ========================================================================= */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-[#181D2D] text-slate-200 border-r border-slate-800 transition-transform duration-200 lg:static lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
              L
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-tight leading-none">
                LIVE.IN
              </h1>
              <p className="text-[10px] text-blue-400 font-medium mt-1">
                DASHBOARD CMS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sidebar Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2">
            Menu Utama
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab('galleries')
              setIsSidebarOpen(false)
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'galleries'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:bg-[#1F2536] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <FolderKanban className="h-4 w-4" />
              </div>
              <span>Katalog Galeri</span>
            </div>
            <span className="text-[10px] bg-[#141824] text-slate-300 px-2 py-0.5 rounded-full font-mono font-bold">
              {galleries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('analytics')
              setIsSidebarOpen(false)
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-300 hover:bg-[#1F2536] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
              <span>Statistik & Status</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden backdrop-blur-xs"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* =========================================================================
          MAIN CMS CANVAS: RIGHT SIDE
      ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 px-4 sm:px-8 py-3.5 border-b flex items-center justify-between bg-[#1E293B]/95 backdrop-blur-sm border-slate-800 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white leading-tight">
                Dashboard
              </h2>
            </div>
          </div>

          <div className="flex items-center">
            {/* User profile dropdown pill with logout */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer select-none"
              >
                <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {adminEmail.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-200 hidden md:inline">
                  Admin
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Masuk Sebagai
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {adminEmail}
                      </p>
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false)
                          handleLogout()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Keluar</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="p-4 sm:p-7 space-y-6 flex-1">
          {/* =========================================================================
              4 VIBRANT METRIC STAT CARDS (Exact match to reference image)
          ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Total Galeri (Vibrant Blue Card) */}
              <div className="bg-gradient-to-r from-[#1E88E5] to-[#2196F3] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">
                      TOTAL GALERI
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {totalCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-white text-[#2196F3] flex items-center justify-center shadow-xs">
                    <FolderKanban className="h-6 w-6 stroke-[2.5]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/20">
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full w-full" />
                  </div>
                </div>
              </div>

              {/* Stat 2: Sedang Memilih (Vibrant Orange Card) */}
              <div className="bg-gradient-to-r from-[#F57C00] to-[#FF9800] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">
                      SEDANG MEMILIH
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {selectingCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-white text-[#FF9800] flex items-center justify-center shadow-xs">
                    <Clock className="h-6 w-6 stroke-[2.5]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/20">
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (selectingCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Stat 3: Selesai Dipilih (Vibrant Purple Card) */}
              <div className="bg-gradient-to-r from-[#7B1FA2] to-[#9C27B0] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">
                      SELESAI DIPILIH
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {finishedCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-white text-[#9C27B0] flex items-center justify-center shadow-xs">
                    <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/20">
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (finishedCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Stat 4: Dilihat Klien (Vibrant Indigo Card) */}
              <div className="bg-gradient-to-r from-[#303F9F] to-[#3F51B5] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-white/85 uppercase tracking-wider">
                      DILIHAT KLIEN
                    </p>
                    <p className="text-3xl font-extrabold text-white mt-1.5 leading-none">
                      {viewedCount}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-white text-[#3F51B5] flex items-center justify-center shadow-xs">
                    <Eye className="h-6 w-6 stroke-[2.5]" />
                  </div>
                </div>
                <div className="mt-4 pt-2 border-t border-white/20">
                  <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                    <div
                      style={{
                        width: `${totalCount > 0 ? (viewedCount / totalCount) * 100 : 0}%`,
                      }}
                      className="h-full bg-white rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

          {/* =========================================================================
              TAB 1: SEMUA GALERI (DEFAULT VIEW)
          ========================================================================= */}
          {activeTab === 'galleries' && (
            <div className="space-y-5">
              {/* Header section with title & "+ Buat Galeri Baru" button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Katalog Galeri Foto
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Kelola dan pantau seluruh sesi pemilihan foto klien.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleResetCreateForm()
                    setIsCreateModalOpen(true)
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>+ Buat Galeri Baru</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="p-4 rounded-xl border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-[#1E293B] border-slate-700/80">
                {/* Search Box */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama klien, slug, atau nomor WhatsApp..."
                    className="w-full pl-9 pr-8 py-2 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
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
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Gallery Cards Grid */}
              {filteredGalleries.length === 0 ? (
                <div className="p-12 text-center rounded-xl border bg-[#1E293B] border-slate-700">
                  <div className="h-12 w-12 rounded-full bg-blue-950/40 text-blue-500 mx-auto flex items-center justify-center mb-3">
                    <Search className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Tidak Ada Galeri yang Cocok
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery
                      ? `Tidak ditemukan galeri dengan kata kunci "${searchQuery}". Coba kata pencarian lain.`
                      : 'Belum ada galeri foto yang dibuat.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterStatus('Semua')
                      handleResetCreateForm()
                      setIsCreateModalOpen(true)
                    }}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    + Buat Galeri Baru
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredGalleries.map((gallery) => {
                    const selectedCount = gallery.selectedPhotos || 0
                    const maxP = gallery.maxPhotos || 60
                    const progressPercent = Math.min(100, Math.round((selectedCount / maxP) * 100))

                    return (
                      <div
                        key={gallery.id}
                        className="rounded-xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden bg-[#1E293B] border-slate-700/80 hover:border-slate-600 shadow-xs"
                      >
                        <div className="p-5 space-y-4">
                          {/* Client Info & Cover */}
                          <div className="flex gap-3.5 items-start">
                            <div className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
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
                                <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs">
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
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>{gallery.date || 'Tanpa Tanggal'}</span>
                              </p>
                              <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate mt-0.5">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span>{gallery.whatsapp || '-'}</span>
                              </p>

                              {/* Status Badge */}
                              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${
                                    gallery.status === 'Selesai dipilih'
                                      ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800'
                                      : gallery.status === 'Sedang memilih'
                                      ? 'bg-amber-950/40 text-amber-300 border border-amber-800'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                                  }`}
                                >
                                  {gallery.status}
                                </span>

                                {gallery.isClientViewed && (
                                  <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-950/40 text-blue-300 border border-blue-800">
                                    Dilihat Klien
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress Meter */}
                          <div className="p-3 rounded-lg border bg-slate-900/60 border-slate-700/60">
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1.5">
                              <span className="font-medium">Foto Dipilih:</span>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {selectedCount} / {maxP} ({progressPercent}%)
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                style={{ width: `${progressPercent}%` }}
                                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                              <span>Sisa waktu: {gallery.remainingDays} hari</span>
                              <span>{gallery.allowDownload ? 'Download ON' : 'Download OFF'}</span>
                            </div>
                          </div>

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
                              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Folder className="h-3.5 w-3.5" />
                              <span className="truncate">Buka Drive</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditModal(gallery)}
                              className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setGalleryToDelete(gallery)}
                              className="border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>

                          {/* Direct Links View */}
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                            <a
                              href={`/livesotory-co/${gallery.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 text-xs font-medium text-center flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Lihat Seleksi</span>
                            </a>
                            <a
                              href={`/${gallery.slug}-3`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 text-xs font-medium text-center flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span>Lihat Album</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* =========================================================================
              TAB 3: ANALYTICS & STATUS BREAKDOWN
          ========================================================================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div
                className={`p-6 rounded-xl border ${
                  isDarkMode
                    ? 'bg-[#1E293B] border-slate-700'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="border-b border-slate-100 dark:border-slate-700 pb-3 mb-5 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ringkasan Aktivitas Pemilihan Klien
                  </h3>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-full">
                    Sinkronisasi Otomatis
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`p-4 rounded-xl border ${
                      isDarkMode
                        ? 'bg-slate-900/60 border-slate-700'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Belum Selesai
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {galleries.filter((g) => g.status !== 'Selesai dipilih').length}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Galeri yang masih dalam proses pemilihan oleh klien.
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      isDarkMode
                        ? 'bg-slate-900/60 border-slate-700'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Siap Diedit / Selesai
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {finishedCount}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Klien sudah selesai memilih batas foto maksimal.
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      isDarkMode
                        ? 'bg-slate-900/60 border-slate-700'
                        : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Tingkat Dilihat Klien
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {totalCount > 0 ? Math.round((viewedCount / totalCount) * 100) : 0}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Persentase klien yang sudah membuka album mereka.
                    </p>
                  </div>
                </div>
              </div>

              {/* Table of active selections */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  isDarkMode
                    ? 'bg-[#1E293B] border-slate-700'
                    : 'bg-white border-slate-200/80 shadow-xs'
                }`}
              >
                <div
                  className={`px-5 py-3.5 border-b font-semibold text-xs text-slate-900 dark:text-white ${
                    isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  Tabel Status Klien & Batas Waktu
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr
                        className={`border-b text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider ${
                          isDarkMode ? 'border-slate-700 bg-slate-900/60' : 'border-slate-100 bg-slate-50/80'
                        }`}
                      >
                        <th className="p-3.5">Klien</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Foto Dipilih</th>
                        <th className="p-3.5">Sisa Hari</th>
                        <th className="p-3.5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {galleries.map((gal) => (
                        <tr
                          key={gal.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-750 transition-colors"
                        >
                          <td className="p-3.5 font-semibold text-slate-900 dark:text-white">
                            {gal.clientName}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                gal.status === 'Selesai dipilih'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : gal.status === 'Sedang memilih'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {gal.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 dark:text-slate-300 font-semibold">
                            {gal.selectedPhotos || 0} / {gal.maxPhotos}
                          </td>
                          <td className="p-3.5 text-slate-500 dark:text-slate-400">
                            {gal.remainingDays} hari
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openShareModalForGallery(gal)}
                              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Kirim WA
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODALS & OVERLAYS (CLEAN MODERN CMS STYLE)
      ========================================================================= */}

      {/* 0. Modal Popup Buat Galeri Baru & Sinkronisasi Drive (Backdrop Blur) */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
          onClick={handleCloseCreateModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[92vh] rounded-2xl border border-slate-700/80 bg-[#1E293B] text-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto"
          >
            {/* Modal Header */}
            <div className="border-b border-slate-700/80 px-6 py-4.5 flex items-center justify-between shrink-0 bg-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Buat Galeri Baru & Sinkronisasi Drive
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tempel tautan folder Google Drive untuk membaca foto dan menerbitkan link seleksi untuk klien.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Field 1: Link Folder Google Drive */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="driveLink"
                      className="text-xs font-semibold text-slate-200 flex items-center gap-2"
                    >
                      <span>1. Link Folder Google Drive</span>
                      <span className="text-[10px] text-rose-500 font-medium bg-rose-950/40 px-1.5 py-0.5 rounded">
                        Wajib
                      </span>
                    </label>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      id="driveLink"
                      type="url"
                      required
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      placeholder="Tempel tautan folder Google Drive (contoh: https://drive.google.com/drive/folders/...)"
                      className="w-full py-2.5 pl-3.5 pr-24 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleScanLink()}
                      disabled={isScanningLink || !driveLink.trim()}
                      className="absolute right-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isScanningLink ? 'Memindai...' : 'Pindai'}
                    </button>
                  </div>

                  {scanError && (
                    <div className="mt-2.5 rounded-lg border border-rose-800 bg-rose-950/40 text-rose-200 p-3 text-xs flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{scanError}</span>
                    </div>
                  )}

                  {scannedPhotos.length > 0 && (
                    <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/40 text-emerald-200 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>Terdeteksi {scannedPhotos.length} Foto dari Google Drive!</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowAllScannedModal(true)}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium hover:bg-slate-700 cursor-pointer shadow-2xs"
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
                            className="aspect-square rounded-md border border-slate-700 overflow-hidden bg-slate-900 cursor-pointer hover:scale-105 transition-all"
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

                {/* Field 2 & 3: Batas Maksimal & Batas Waktu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="maxPhotos"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      2. Batas Maksimal Foto Dipilih
                    </label>
                    <input
                      id="maxPhotos"
                      type="number"
                      min={1}
                      max={2000}
                      value={maxPhotos}
                      onChange={(e) => setMaxPhotos(e.target.value)}
                      placeholder="60 (Bawaan)"
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Kosongkan untuk otomatis menggunakan 60 foto.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="selectionDeadline"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      3. Batas Waktu Klien Memilih
                    </label>
                    <select
                      id="selectionDeadline"
                      value={selectionDeadline}
                      onChange={(e) => setSelectionDeadline(e.target.value)}
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white"
                    >
                      <option value="7 hari">7 Hari (Cepat)</option>
                      <option value="14 hari">14 Hari (2 Minggu)</option>
                      <option value="30 hari">30 Hari (Standar)</option>
                      <option value="60 hari">60 Hari (2 Bulan)</option>
                      <option value="90 hari">90 Hari (3 Bulan)</option>
                    </select>
                  </div>
                </div>

                {/* Field 4 & 5: Nama Klien & Tanggal Acara */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="clientName"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      4. Nama Klien / Acara
                    </label>
                    <input
                      id="clientName"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Contoh: Wedding Sarah & Kevin / Wisuda Maya"
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Jika kosong, otomatis mengikuti nama folder Google Drive.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="eventDate"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      5. Tanggal Acara
                    </label>
                    <input
                      id="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white"
                    />
                  </div>
                </div>

                {/* Field 6 & 7: WhatsApp & Email Klien */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="clientWhatsapp"
                      className="text-xs font-semibold text-slate-200 flex items-center justify-between mb-1.5"
                    >
                      <span>6. Nomor WhatsApp Klien</span>
                      <span className="text-[10px] text-rose-500 font-medium bg-rose-950/40 px-1.5 py-0.5 rounded">
                        Wajib
                      </span>
                    </label>
                    <input
                      id="clientWhatsapp"
                      type="tel"
                      required
                      value={clientWhatsapp}
                      onChange={handleWhatsappChange}
                      placeholder="Contoh: 081234567890"
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="clientEmail"
                      className="block text-xs font-semibold text-slate-200 mb-1.5"
                    >
                      7. Email Klien (Opsional)
                    </label>
                    <input
                      id="clientEmail"
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="Contoh: nama@email.com"
                      className="w-full py-2.5 px-3 rounded-lg border text-xs sm:text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-900 border-slate-700 text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Checkbox Download */}
                <div className="p-4 rounded-lg border bg-slate-900/60 border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDownload}
                      onChange={(e) => setAllowDownload(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white">
                        Izinkan Klien Mengunduh Foto
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Jika dinonaktifkan, klien hanya dapat melihat dan memilih foto tanpa tombol unduh.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!isFormValid || isScanningModalOpen}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <Check className="h-4 w-4 stroke-[2.5]" />
                    <span>Buat & Simpan Galeri</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 1. Share Ready Modal (WhatsApp Message) */}
      {isShareModalOpen && shareModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border overflow-hidden shadow-2xl ${
              isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {/* Header */}
            <div className="border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Share2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bagikan Link Galeri</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Kirim undangan kurasi foto via WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                Penerima: <span className="font-semibold text-slate-900 dark:text-white">{shareModalData.clientName}</span> ({shareModalData.whatsapp})
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
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span>Pratinjau Pesan:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(shareModalData.fullMessage)
                      showToast('Teks pesan berhasil disalin!')
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    Salin Teks
                  </button>
                </div>
                <textarea
                  readOnly
                  value={shareModalData.fullMessage}
                  rows={7}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-xs font-mono bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none select-all"
                />
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={shareModalData.selectionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-center py-2 text-xs font-semibold transition-colors"
                >
                  Buka Link Seleksi
                </a>
                <a
                  href={shareModalData.albumLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-center py-2 text-xs font-semibold transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className={`w-full max-w-2xl rounded-2xl border overflow-hidden shadow-2xl my-8 ${
              isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            {/* Header */}
            <div className="border-b border-slate-100 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit Galeri</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{editingGallery.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setGalleryToEdit(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Klien / Acara
                  </label>
                  <input
                    type="text"
                    required
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    placeholder="Contoh: Wedding Sarah & Kevin"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nomor WhatsApp Klien
                  </label>
                  <input
                    type="tel"
                    required
                    value={editWhatsapp}
                    onChange={handleEditWhatsappChange}
                    placeholder="Contoh: 081234567890"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Slug URL
                  </label>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    placeholder="contoh: wedding-sarah-kevin"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tanggal Acara
                  </label>
                  <input
                    type="date"
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Belum mulai">Belum mulai</option>
                    <option value="Sedang memilih">Sedang memilih</option>
                    <option value="Selesai dipilih">Selesai dipilih</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Batas Maksimal Foto
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editMaxPhotos}
                    onChange={(e) => setEditMaxPhotos(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sisa Hari Memilih
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editRemainingDays}
                    onChange={(e) => setEditRemainingDays(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Link Folder Google Drive
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editDriveLink}
                    onChange={(e) => setEditDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/drive/folders/..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleEditRescanDrive}
                    disabled={isEditScanning}
                    className="rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isEditScanning ? 'Memindai...' : 'Pindai Ulang'}
                  </button>
                </div>
                {editScanError && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1">
                    {editScanError}
                  </p>
                )}
                {editScanSuccessMsg && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                    {editScanSuccessMsg}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  PIN Keamanan Album (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={editPinCode}
                  onChange={(e) => setEditPinCode(e.target.value)}
                  placeholder="Contoh: 1234 (4-8 digit angka)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 p-2.5 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setGalleryToEdit(null)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
              isDarkMode ? 'bg-[#1E293B] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-lg mb-3">
              ⚠️
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Galeri &ldquo;{galleryToDelete.clientName}&rdquo;?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Tindakan ini tidak bisa dibatalkan. Seluruh data konfigurasi dan riwayat pemilihan foto klien akan dihapus secara permanen.
            </p>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-700 pt-4">
              <button
                type="button"
                onClick={() => setGalleryToDelete(null)}
                className="rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
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

      {/* 4. Scanning Modal (Proses Baca Drive) */}
      {isScanningModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white p-6 shadow-2xl text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <Folder className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                Memindai Google Drive...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {scanStatusText}
              </p>
            </div>

            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${scanProgress}%` }}
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. Lightbox Preview Photo */}
      {previewLightboxPhoto && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
          onClick={() => setPreviewLightboxPhoto(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl max-w-4xl max-h-[90vh] flex flex-col items-center animate-in fade-in zoom-in-95"
          >
            <div className="w-full pb-2 mb-2 flex justify-between items-center text-xs text-slate-300">
              <span className="font-medium truncate max-w-xs">{previewLightboxPhoto.filename}</span>
              <button
                type="button"
                onClick={() => setPreviewLightboxPhoto(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-5 overflow-y-auto"
          onClick={() => setShowAllScannedModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-700/80 bg-[#1E293B] text-white shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 my-auto"
          >
            {/* Modal Header */}
            <div className="border-b border-slate-700/80 px-6 py-4 flex items-center justify-between shrink-0 bg-[#1E293B]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center text-sm">
                  📸
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2.5">
                    <span>Semua Foto Terdeteksi</span>
                    <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {scannedPhotos.length} Foto
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Klik foto mana saja untuk melihat pratinjau resolusi penuh.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
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
                    className="group relative w-full aspect-square rounded-xl border border-slate-700 bg-slate-900 overflow-hidden cursor-pointer shadow-xs hover:border-blue-500 hover:shadow-lg transition-all duration-200"
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
                      <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono text-slate-200">
                        #{idx + 1}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-700/80 px-6 py-3.5 bg-[#181D2D] flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>
                Total <strong>{scannedPhotos.length}</strong> foto terindeks dari folder Google Drive
              </span>
              <button
                type="button"
                onClick={() => setShowAllScannedModal(false)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 shadow-xl flex items-center gap-2.5 text-xs font-medium border border-slate-800 dark:border-slate-100 animate-in fade-in slide-in-from-bottom-2">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}