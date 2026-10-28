import type { DrivePhotoItem } from './googleDrive.ts'
import { db, isFirebaseConfigured } from './firebase.ts'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore'

function sanitizeForFirestore(data: any): any {
  if (data === undefined) return null
  if (data === null || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(sanitizeForFirestore)
  const clean: Record<string, any> = {}
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val)
    }
  }
  return clean
}

export interface GalleryPhoto extends DrivePhotoItem {
  category?: string
  isHighlight?: boolean
  aspect?: 'portrait' | 'landscape'
}

export function getPhotoThumbnailUrl(photo: GalleryPhoto, size = 600): string {
  const fileId = photo.fileId || (/^[a-zA-Z0-9_-]{25,}$/.test(photo.id) ? photo.id : '')
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
  }
  if (photo.thumbnailUrl && !photo.thumbnailUrl.startsWith('/api/')) {
    return photo.thumbnailUrl
  }
  return photo.url || ''
}

export interface GalleryData {
  id: string
  clientName: string
  date: string
  maxPhotos: number
  selectedPhotos: number
  remainingDays: number
  status: 'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih'
  isClientViewed: boolean
  viewCount?: number
  whatsapp: string
  driveLink: string
  slug: string
  shareToken: string
  pinCode?: string
  coverUrl?: string
  highlightDescription?: string
  selectedPhotoIds: string[]
  photos: GalleryPhoto[]
  allowDownload?: boolean
}

const STORAGE_KEY = 'livein_galleries_v3'

export const INITIAL_GALLERIES: GalleryData[] = []

export const DELETED_KEY = 'livein_deleted_galleries_v1'

export function isDummyGallery(_item: any): boolean {
  // Semua data yang ditambahkan oleh user adalah data galeri nyata (bukan dummy)
  return false
}

export function normalizeGalleryItem(item: any): GalleryData {
  if (!item || typeof item !== 'object') {
    return {
      id: `gal-${Date.now()}`,
      clientName: 'Klien Baru',
      date: new Date().toISOString().split('T')[0],
      maxPhotos: 60,
      selectedPhotos: 0,
      remainingDays: 30,
      status: 'Belum mulai',
      isClientViewed: false,
      viewCount: 0,
      whatsapp: '',
      driveLink: '',
      slug: 'klien',
      shareToken: 'vtmsvc3urqfm',
      selectedPhotoIds: [],
      photos: [],
      allowDownload: true,
    }
  }

  const rawPhotos = Array.isArray(item.photos) ? item.photos : []

  // Deteksi apakah foto-foto ini sebelumnya terkena auto-generate kategori modulo-3 palsu
  const isArtificialModulo =
    rawPhotos.length > 5 &&
    rawPhotos.every((p: any, i: number) => {
      const cat = p?.category
      const expected = i % 3 === 0 ? 'Keluarga' : i % 3 === 1 ? 'Group' : 'Sendiri'
      return cat === expected
    })

  const selectedIds: string[] = Array.isArray(item.selectedPhotoIds)
    ? item.selectedPhotoIds.map(String)
    : []

  const photos: GalleryPhoto[] = rawPhotos.map((p: any, i: number) => {
    const pId = p?.id ? String(p.id) : `photo-${i}`
    const isSelected = selectedIds.includes(pId)
    return {
      id: pId,
      fileId: p?.fileId ? String(p.fileId) : p?.id ? String(p.id) : `file-${i}`,
      filename: p?.filename ? String(p.filename) : `FOTO_${String(i + 1).padStart(4, '0')}.JPG`,
      url: p?.url ? String(p.url) : '',
      thumbnailUrl: p?.thumbnailUrl ? String(p.thumbnailUrl) : p?.url ? String(p.url) : '',
      mimeType: p?.mimeType,
      size: typeof p?.size === 'number' ? p.size : undefined,
      aspect: p?.aspect === 'landscape' ? 'landscape' : 'portrait',
      category:
        isArtificialModulo
          ? undefined
          : p?.category && typeof p.category === 'string' && p.category.trim()
          ? p.category.trim()
          : undefined,
      // Highlight is exclusively derived from client selection (selectedPhotoIds)
      isHighlight: isSelected,
    }
  })

  const rawClientName = (item.clientName || 'Klien Baru').toString().trim()
  const rawSlug = (item.slug || rawClientName)
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'klien'

  const selectedPhotoIds = Array.isArray(item.selectedPhotoIds)
    ? item.selectedPhotoIds.map((id: any) => String(id))
    : []

  const maxPhotos = Number(item.maxPhotos) || 60
  const selectedCount =
    typeof item.selectedPhotos === 'number' && item.selectedPhotos > selectedPhotoIds.length
      ? item.selectedPhotos
      : selectedPhotoIds.length

  // Sinkronisasi status galeri:
  // - Jika status tersimpan sudah 'Selesai dipilih' atau kuota terpenuhi -> 'Selesai dipilih'
  // - Jika sudah ada foto yang dipilih (> 0) atau berstatus 'Sedang memilih' -> 'Sedang memilih'
  // - Jika belum ada foto (0) -> 'Belum mulai'
  const rawStatus = (item.status || '').toString().trim().toLowerCase()
  let computedStatus: 'Belum mulai' | 'Sedang memilih' | 'Selesai dipilih' = 'Belum mulai'

  if (rawStatus === 'selesai dipilih' || (maxPhotos > 0 && selectedCount >= maxPhotos)) {
    computedStatus = 'Selesai dipilih'
  } else if (selectedCount > 0 || rawStatus === 'sedang memilih') {
    computedStatus = 'Sedang memilih'
  } else {
    computedStatus = 'Belum mulai'
  }

  return {
    id: (item.id || `gal-${Date.now()}`).toString(),
    clientName: rawClientName,
    date: (item.date || new Date().toISOString().split('T')[0]).toString(),
    maxPhotos,
    selectedPhotos: selectedCount,
    remainingDays:
      typeof item.remainingDays === 'number'
        ? Math.max(0, item.remainingDays)
        : !isNaN(Number(item.remainingDays))
        ? Math.max(0, Number(item.remainingDays))
        : 7,
    status: computedStatus,
    isClientViewed: Boolean(item.isClientViewed),
    viewCount:
      typeof item.viewCount === 'number'
        ? Math.max(0, item.viewCount)
        : item.isClientViewed
        ? 1
        : 0,
    whatsapp: (item.whatsapp || '').toString(),
    driveLink: (item.driveLink || '').toString(),
    slug: rawSlug,
    shareToken: (item.shareToken || 'vtmsvc3urqfm').toString(),
    pinCode: item.pinCode ? String(item.pinCode) : undefined,
    coverUrl: (
      (selectedPhotoIds.length > 0
        ? photos.find((p) => p && String(p.id) === String(selectedPhotoIds[0]))?.url
        : undefined) ||
      item.coverUrl ||
      photos[0]?.url ||
      ''
    ).toString(),
    highlightDescription: (item.highlightDescription || '').toString(),
    selectedPhotoIds,
    photos,
    allowDownload:
      item.allowDownload !== undefined ? Boolean(item.allowDownload) : true,
  }
}

let memoryGalleries: GalleryData[] = []

// Bersihkan cache galeri dari localStorage browser agar data sepenuhnya realtime dari Firestore
try {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('livein_galleries_v2')
  localStorage.removeItem('livein_galleries_v1')
  localStorage.removeItem('livein_galleries')
  localStorage.removeItem(DELETED_KEY)
} catch {}

export function getDeletedGalleryIds(): string[] {
  return []
}

export function saveDeletedGalleryIds(_ids: string[]): void {}

export function getStoredGalleries(): GalleryData[] {
  return memoryGalleries
}

export function saveStoredGalleries(galleries: GalleryData[]): void {
  memoryGalleries = galleries.map(normalizeGalleryItem)
}

export function saveOrUpdateGallery(newGallery: GalleryData): void {
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const normalized = normalizeGalleryItem(newGallery)

  const current = getStoredGalleries()
  const index = current.findIndex((g) => clean(g.id) === clean(normalized.id))
  if (index >= 0) {
    current[index] = { ...current[index], ...normalized }
  } else {
    if (current.some((g) => clean(g.slug) === clean(normalized.slug))) {
      normalized.slug = `${normalized.slug}-${Date.now().toString().slice(-4)}`
    }
    current.unshift(normalized)
  }
  saveStoredGalleries(current)

  if (isFirebaseConfigured && normalized.id) {
    setDoc(doc(db, 'galleries', normalized.id), sanitizeForFirestore(normalized), {
      merge: true,
    }).catch((err) => console.warn('Firestore setDoc failed:', err))
  }
}

export function updateGallery(updated: GalleryData): GalleryData[] {
  const current = getStoredGalleries()
  const normalized = normalizeGalleryItem(updated)
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const targetId = clean(normalized.id)

  let finalItem: GalleryData = normalized
  const index = current.findIndex((g) => clean(g.id) === targetId)
  if (index >= 0) {
    finalItem = {
      ...current[index],
      ...normalized,
      photos:
        normalized.photos && normalized.photos.length > 0
          ? normalized.photos
          : current[index].photos,
      coverUrl: normalized.coverUrl || current[index].coverUrl,
    }
    current[index] = finalItem
  } else {
    current.unshift(normalized)
  }
  saveStoredGalleries(current)

  if (isFirebaseConfigured && finalItem.id) {
    setDoc(doc(db, 'galleries', finalItem.id), sanitizeForFirestore(finalItem), {
      merge: true,
    }).catch((err) => console.warn('Firestore updateGallery failed:', err))
  }

  return current
}

export function toggleGalleryDownload(id: string): GalleryData[] {
  const current = getStoredGalleries()
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const targetId = clean(id)
  const index = current.findIndex((g) => clean(g.id) === targetId)
  if (index >= 0) {
    const prev = current[index].allowDownload !== false
    current[index] = {
      ...current[index],
      allowDownload: !prev,
    }
    saveStoredGalleries(current)

    if (isFirebaseConfigured && current[index].id) {
      updateDoc(doc(db, 'galleries', current[index].id), {
        allowDownload: !prev,
      }).catch((err) => console.warn('Firestore toggleDownload failed:', err))
    }
  }
  return current
}

export function deleteGallery(id: string, slug?: string): GalleryData[] {
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const targetId = clean(id)
  const targetSlug = clean(slug)

  let deletedDocId = targetId
  const current = getStoredGalleries()
  const updated = current.filter((g) => {
    const gid = clean(g.id)
    const gslug = clean(g.slug)
    const gname = clean(g.clientName)
    if (targetId && (gid === targetId || gslug === targetId || gname === targetId)) {
      deletedDocId = g.id
      return false
    }
    if (targetSlug && (gslug === targetSlug || gid === targetSlug || gname === targetSlug)) {
      deletedDocId = g.id
      return false
    }
    return true
  })

  saveStoredGalleries(updated)

  if (isFirebaseConfigured) {
    if (deletedDocId) {
      deleteDoc(doc(db, 'galleries', deletedDocId)).catch((err) =>
        console.warn('Firestore deleteDoc failed:', err)
      )
    }
    if (targetSlug && targetSlug !== clean(deletedDocId)) {
      deleteDoc(doc(db, 'galleries', targetSlug)).catch(() => {})
    }
  }

  window.dispatchEvent(new Event('galleries-updated'))
  return updated
}

export function deleteMultipleGalleries(ids: string[]): GalleryData[] {
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const targetIds = new Set(ids.map((id) => clean(id)))
  const current = getStoredGalleries()
  const deletedDocIds: string[] = []

  const updated = current.filter((g) => {
    const gid = clean(g.id)
    const gslug = clean(g.slug)
    if (targetIds.has(gid) || targetIds.has(gslug)) {
      if (g.id) deletedDocIds.push(g.id)
      return false
    }
    return true
  })

  saveStoredGalleries(updated)

  if (isFirebaseConfigured && deletedDocIds.length > 0) {
    deletedDocIds.forEach((docId) => {
      deleteDoc(doc(db, 'galleries', docId)).catch((err) =>
        console.warn('Firestore bulk deleteDoc failed:', err)
      )
    })
  }

  window.dispatchEvent(new Event('galleries-updated'))
  return updated
}

export const toSlugTarget = (s?: string): string => {
  if (!s) return ''
  try {
    s = decodeURIComponent(String(s))
  } catch {}
  return s
    .toLowerCase()
    .replace(/-3$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()
}

export function findGalleryBySlug(slug: string): GalleryData | null {
  if (!slug) return null
  const target = toSlugTarget(slug)
  if (!target) return null

  const galleries = getStoredGalleries()
  if (!galleries || galleries.length === 0) {
    return null
  }

  // Exact match by slug, id, or clientName (with or without -3)
  return (
    galleries.find((g) => {
      return (
        toSlugTarget(g.slug) === target ||
        toSlugTarget(g.id) === target ||
        toSlugTarget(g.clientName) === target
      )
    }) || null
  )
}

export function togglePhotoSelection(
  gallerySlugOrId: string,
  photoId: string
): { updatedGallery: GalleryData | null; isSelected: boolean } {
  const galleries = getStoredGalleries()
  const clean = (s?: string) => (s ? String(s).toLowerCase().replace(/-3$/, '').trim() : '')
  const target = clean(gallerySlugOrId)

  const gallery =
    findGalleryBySlug(gallerySlugOrId) ||
    galleries.find(
      (g) => clean(g.id) === target || clean(g.slug) === target || clean(g.clientName) === target
    ) ||
    null

  if (!gallery) return { updatedGallery: null, isSelected: false }

  const pId = String(photoId)
  const currentIds = Array.isArray(gallery.selectedPhotoIds)
    ? gallery.selectedPhotoIds.map(String)
    : []
  const isAlreadySelected = currentIds.includes(pId)
  let newSelectedIds: string[] = []

  if (isAlreadySelected) {
    newSelectedIds = currentIds.filter((id) => id !== pId)
  } else {
    if (currentIds.length >= gallery.maxPhotos) {
      return { updatedGallery: gallery, isSelected: false }
    }
    newSelectedIds = [...currentIds, pId]
  }

  const updatedPhotos = (gallery.photos || []).map((p) => ({
    ...p,
    isHighlight: newSelectedIds.includes(String(p.id)),
  }))

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
    status:
      newSelectedIds.length === 0
        ? 'Belum mulai'
        : newSelectedIds.length >= gallery.maxPhotos
        ? 'Selesai dipilih'
        : 'Sedang memilih',
  }

  saveOrUpdateGallery(updatedGallery)

  return { updatedGallery, isSelected: !isAlreadySelected }
}

export function incrementGalleryViewCount(slugOrId: string): GalleryData | null {
  try {
    const galleries = getStoredGalleries()
    const target = toSlugTarget(slugOrId)

    const idx = galleries.findIndex((g) => {
      return (
        toSlugTarget(g.slug) === target ||
        toSlugTarget(g.id) === target ||
        toSlugTarget(g.clientName) === target
      )
    })

    if (idx >= 0) {
      const current = galleries[idx]
      const newCount = (current.viewCount || 0) + 1
      const updated: GalleryData = {
        ...current,
        isClientViewed: true,
        viewCount: newCount,
      }
      galleries[idx] = updated
      saveStoredGalleries(galleries)

      if (isFirebaseConfigured && current.id) {
        updateDoc(doc(db, 'galleries', current.id), {
          viewCount: newCount,
          isClientViewed: true,
        }).catch((err) => console.warn('Firestore viewCount update error:', err))
      }

      return updated
    }
  } catch (e) {
    console.error('Error incrementing gallery view count:', e)
  }
  return null
}

export async function syncGalleriesFromFirestore(): Promise<GalleryData[]> {
  if (!isFirebaseConfigured) return getStoredGalleries()
  try {
    const snap = await getDocs(collection(db, 'galleries'))
    if (!snap.empty) {
      const remoteGalleries: GalleryData[] = []
      snap.forEach((d) => {
        const item = d.data()
        if (item) {
          remoteGalleries.push(normalizeGalleryItem({ ...item, id: item.id || d.id }))
        }
      })
      if (remoteGalleries.length > 0) {
        saveStoredGalleries(remoteGalleries)
        window.dispatchEvent(new Event('galleries-updated'))
        return remoteGalleries
      }
    }
  } catch (err) {
    console.warn('syncGalleriesFromFirestore failed:', err)
  }
  return getStoredGalleries()
}

export async function fetchGalleryBySlug(slug: string): Promise<GalleryData | null> {
  const local = findGalleryBySlug(slug)
  if (!isFirebaseConfigured) return local

  try {
    const target = toSlugTarget(slug)
    const snap = await getDocs(collection(db, 'galleries'))
    let foundDoc: GalleryData | null = null

    snap.forEach((d) => {
      const raw = d.data()
      if (!raw) return
      const data = normalizeGalleryItem({ ...raw, id: raw.id || d.id })
      if (
        toSlugTarget(data.slug) === target ||
        toSlugTarget(data.id) === target ||
        toSlugTarget(d.id) === target ||
        toSlugTarget(data.clientName) === target
      ) {
        foundDoc = data
      }
    })

    if (foundDoc) {
      saveOrUpdateGallery(foundDoc)
      return foundDoc
    }

    return null
  } catch (err) {
    console.warn('fetchGalleryBySlug cloud fetch failed:', err)
    return local
  }
}
