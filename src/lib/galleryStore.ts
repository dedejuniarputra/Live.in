import { scanGoogleDriveFolder, type DrivePhotoItem } from './googleDrive.ts'

export interface GalleryPhoto extends DrivePhotoItem {
  category?: 'Group' | 'Keluarga' | 'Sendiri'
  isHighlight?: boolean
  aspect?: 'portrait' | 'landscape'
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
  whatsapp: string
  driveLink: string
  slug: string
  shareToken: string
  pinCode?: string
  coverUrl?: string
  highlightDescription?: string
  selectedPhotoIds: string[]
  photos: GalleryPhoto[]
}

const STORAGE_KEY = 'livein_galleries_v3'

// Sample family & wedding photo seeds with varied orientations (portrait & landscape)
const SEED_PHOTOS: Array<{
  url: string
  aspect: 'portrait' | 'landscape'
  category: 'Group' | 'Keluarga' | 'Sendiri'
  isHighlight?: boolean
}> = [
  {
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
    aspect: 'portrait',
    category: 'Keluarga',
    isHighlight: true,
  },
  {
    url: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a',
    aspect: 'portrait',
    category: 'Keluarga',
  },
  {
    url: 'https://images.unsplash.com/photo-1520854221256-17451cc331bf',
    aspect: 'portrait',
    category: 'Keluarga',
  },
  {
    url: 'https://images.unsplash.com/photo-1606800052052-a08af7148866',
    aspect: 'portrait',
    category: 'Sendiri',
    isHighlight: true,
  },
  {
    url: 'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6',
    aspect: 'portrait',
    category: 'Sendiri',
  },
  {
    url: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b',
    aspect: 'portrait',
    category: 'Group',
  },
  {
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
    aspect: 'landscape',
    category: 'Group',
    isHighlight: true,
  },
  {
    url: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8',
    aspect: 'landscape',
    category: 'Group',
  },
  {
    url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf',
    aspect: 'landscape',
    category: 'Keluarga',
    isHighlight: true,
  },
  {
    url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486',
    aspect: 'portrait',
    category: 'Sendiri',
  },
  {
    url: 'https://images.unsplash.com/photo-1544078751-58fee2d8a03b',
    aspect: 'portrait',
    category: 'Sendiri',
  },
  {
    url: 'https://images.unsplash.com/photo-1529636798458-92182e662485',
    aspect: 'landscape',
    category: 'Keluarga',
  },
]

export const INITIAL_GALLERIES: GalleryData[] = [
  {
    id: 'gal-wisuda-putra-22-agustus-2026',
    clientName: 'WISUDA PUTRA 22 AGUSTUS 2026',
    date: '2026-08-22',
    maxPhotos: 120,
    selectedPhotos: 0,
    remainingDays: 30,
    status: 'Belum mulai',
    isClientViewed: false,
    whatsapp: '08123456789',
    driveLink:
      'https://drive.google.com/drive/folders/1kXimzIykec_WamuNSTm37BHB3E11cJDZ?usp=drive_link',
    slug: 'wisuda-putra-22-agustus-2026',
    shareToken: 'vtmsvc3urqfm',
    coverUrl:
      'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1600&q=80',
    selectedPhotoIds: [],
    photos: Array.from({ length: 441 }).map((_, i) => {
      const num = 1700 + i
      const seed = SEED_PHOTOS[i % SEED_PHOTOS.length]
      const category: 'Group' | 'Keluarga' | 'Sendiri' =
        i < 126 ? 'Group' : i < 126 + 149 ? 'Keluarga' : 'Sendiri'
      return {
        id: `pjas-${num}`,
        fileId: `drive_pjas_${num}`,
        filename: `PJAS${num}.jpg`,
        url: `${seed.url}?auto=format&fit=crop&w=1600&q=80`,
        thumbnailUrl: `${seed.url}?auto=format&fit=crop&w=600&q=80`,
        aspect: seed.aspect,
        category,
        isHighlight: i % 10 === 0,
      }
    }),
  },
  {
    id: 'gal-dede',
    clientName: 'Dede',
    date: '2026-09-29',
    maxPhotos: 60,
    selectedPhotos: 0,
    remainingDays: 30,
    status: 'Belum mulai',
    isClientViewed: false,
    whatsapp: '08123456789',
    driveLink: 'https://drive.google.com/drive/folders/sample-dede-wedding',
    slug: 'dede',
    shareToken: 'vtmsvc3urqfm',
    coverUrl:
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80',
    selectedPhotoIds: [],
    photos: Array.from({ length: 48 }).map((_, i) => {
      const num = 101 + i
      const seed = SEED_PHOTOS[i % SEED_PHOTOS.length]
      return {
        id: `df-${num}`,
        fileId: `drive_sample_${num}`,
        filename: `DSC_${String(num).padStart(4, '0')}.JPG`,
        url: `${seed.url}?auto=format&fit=crop&w=1600&q=80`,
        thumbnailUrl: `${seed.url}?auto=format&fit=crop&w=600&q=80`,
        aspect: seed.aspect,
        category: seed.category,
        isHighlight: seed.isHighlight,
      }
    }),
  },
]

export const DELETED_KEY = 'livein_deleted_galleries_v1'

export function normalizeGalleryItem(item: any): GalleryData {
  if (!item || typeof item !== 'object') {
    return INITIAL_GALLERIES[0]
  }

  const rawPhotos = Array.isArray(item.photos) ? item.photos : []
  const photos: GalleryPhoto[] = rawPhotos.map((p: any, i: number) => ({
    id: p?.id ? String(p.id) : `photo-${i}`,
    fileId: p?.fileId ? String(p.fileId) : p?.id ? String(p.id) : `file-${i}`,
    filename: p?.filename ? String(p.filename) : `FOTO_${String(i + 1).padStart(4, '0')}.JPG`,
    url: p?.url ? String(p.url) : '',
    thumbnailUrl: p?.thumbnailUrl ? String(p.thumbnailUrl) : p?.url ? String(p.url) : '',
    mimeType: p?.mimeType,
    size: typeof p?.size === 'number' ? p.size : undefined,
    aspect: p?.aspect === 'landscape' ? 'landscape' : 'portrait',
    category:
      p?.category === 'Group' || p?.category === 'Keluarga' || p?.category === 'Sendiri'
        ? p.category
        : i % 3 === 0
        ? 'Keluarga'
        : i % 3 === 1
        ? 'Group'
        : 'Sendiri',
    isHighlight: Boolean(p?.isHighlight),
  }))

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

  return {
    id: (item.id || `gal-${Date.now()}`).toString(),
    clientName: rawClientName,
    date: (item.date || new Date().toISOString().split('T')[0]).toString(),
    maxPhotos: Number(item.maxPhotos) || 60,
    selectedPhotos: selectedPhotoIds.length,
    remainingDays: Number(item.remainingDays) || 30,
    status:
      item.status === 'Selesai dipilih' || item.status === 'Sedang memilih'
        ? item.status
        : 'Belum mulai',
    isClientViewed: Boolean(item.isClientViewed),
    whatsapp: (item.whatsapp || '').toString(),
    driveLink: (item.driveLink || '').toString(),
    slug: rawSlug,
    shareToken: (item.shareToken || 'vtmsvc3urqfm').toString(),
    pinCode: item.pinCode ? String(item.pinCode) : undefined,
    coverUrl: (item.coverUrl || photos[0]?.url || '').toString(),
    highlightDescription: (item.highlightDescription || '').toString(),
    selectedPhotoIds,
    photos,
  }
}

export function getDeletedGalleryIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).toLowerCase().trim())
      }
    }
  } catch {}
  return []
}

export function saveDeletedGalleryIds(ids: string[]): void {
  try {
    const unique = Array.from(new Set(ids.map((s) => String(s).toLowerCase().trim())))
    localStorage.setItem(DELETED_KEY, JSON.stringify(unique))
  } catch (e) {
    console.error('Failed to save deleted galleries list', e)
  }
}

export function getStoredGalleries(): GalleryData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeGalleryItem)
        }
      } catch {}
      return []
    }

    // First-time onboarding / migration from older version keys ONLY when STORAGE_KEY is not set
    const legacyKeys = [
      'livein_galleries_v2',
      'livein_galleries_v1',
      'livein_galleries',
    ]
    let foundList: GalleryData[] = []
    for (const key of legacyKeys) {
      const oldRaw = localStorage.getItem(key)
      if (oldRaw) {
        try {
          const parsed = JSON.parse(oldRaw)
          if (Array.isArray(parsed) && parsed.length > 0) {
            foundList = parsed.map(normalizeGalleryItem)
            break
          }
        } catch {}
      }
    }

    if (foundList.length === 0) {
      foundList = INITIAL_GALLERIES.map(normalizeGalleryItem)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(foundList))
    return foundList
  } catch {
    return INITIAL_GALLERIES.map(normalizeGalleryItem)
  }
}

export function saveStoredGalleries(galleries: GalleryData[]): void {
  try {
    const normalized = galleries.map(normalizeGalleryItem)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch (e) {
    console.error('Failed to save galleries', e)
  }
}

export function saveOrUpdateGallery(newGallery: GalleryData): void {
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const normalized = normalizeGalleryItem(newGallery)

  const current = getStoredGalleries()
  const index = current.findIndex(
    (g) =>
      clean(g.id) === clean(normalized.id) ||
      clean(g.slug) === clean(normalized.slug)
  )
  if (index >= 0) {
    current[index] = { ...current[index], ...normalized }
  } else {
    current.unshift(normalized)
  }
  saveStoredGalleries(current)
}

export function deleteGallery(id: string, slug?: string): GalleryData[] {
  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const targetId = clean(id)
  const targetSlug = clean(slug)

  const current = getStoredGalleries()
  const updated = current.filter((g) => {
    const gid = clean(g.id)
    const gslug = clean(g.slug)
    const gname = clean(g.clientName)
    if (targetId && (gid === targetId || gslug === targetId || gname === targetId)) {
      return false
    }
    if (targetSlug && (gslug === targetSlug || gid === targetSlug || gname === targetSlug)) {
      return false
    }
    return true
  })

  saveStoredGalleries(updated)
  return updated
}

export function findGalleryBySlug(slug: string): GalleryData | null {
  const galleries = getStoredGalleries()
  if (galleries.length === 0) {
    return INITIAL_GALLERIES[0] || null
  }
  if (!slug) return galleries[0]

  const cleanAlphanumeric = (s?: string) =>
    s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, '') : ''

  // Decode URI component in case URL contains %20 or encoded characters
  let decodedSlug = ''
  try {
    decodedSlug = decodeURIComponent(slug).trim()
  } catch {
    decodedSlug = String(slug).trim()
  }

  const baseSlug = decodedSlug.replace(/-3$/, '').trim()
  const targetClean = cleanAlphanumeric(baseSlug)

  // 1. Exact raw match (slug, clientName, id)
  let match = galleries.find((g) => {
    if (!g) return false
    const s = String(g.slug || '').toLowerCase()
    const n = String(g.clientName || '').toLowerCase()
    const id = String(g.id || '').toLowerCase()
    const t = baseSlug.toLowerCase()
    return s === t || n === t || id === t
  })

  // 2. Alphanumeric match (ignores hyphens, spaces, uppercase, symbols)
  if (!match && targetClean) {
    match = galleries.find((g) => {
      if (!g) return false
      return (
        cleanAlphanumeric(g.slug) === targetClean ||
        cleanAlphanumeric(g.clientName) === targetClean ||
        cleanAlphanumeric(g.id) === targetClean
      )
    })
  }

  // 3. Substring match
  if (!match && targetClean) {
    match = galleries.find((g) => {
      if (!g) return false
      const s = cleanAlphanumeric(g.slug)
      const n = cleanAlphanumeric(g.clientName)
      return (
        (s && (s.includes(targetClean) || targetClean.includes(s))) ||
        (n && (n.includes(targetClean) || targetClean.includes(n)))
      )
    })
  }

  // 4. Keyword fallback (wisuda, putra, dede, wedding)
  if (!match && targetClean) {
    if (targetClean.includes('wisuda') || targetClean.includes('putra')) {
      match = galleries.find((g) => {
        const s = cleanAlphanumeric(g.slug)
        const n = cleanAlphanumeric(g.clientName)
        return s.includes('wisuda') || n.includes('wisuda') || s.includes('putra') || n.includes('putra')
      })
    }
  }

  // 5. Ultimate fallback: Return the latest stored gallery so client NEVER sees an empty screen
  return match || galleries[0] || INITIAL_GALLERIES[0] || null
}

export function togglePhotoSelection(
  gallerySlug: string,
  photoId: string
): { updatedGallery: GalleryData | null; isSelected: boolean } {
  const galleries = getStoredGalleries()
  const gallery = findGalleryBySlug(gallerySlug)
  if (!gallery) return { updatedGallery: null, isSelected: false }

  const currentIds = Array.isArray(gallery.selectedPhotoIds) ? gallery.selectedPhotoIds : []
  const isAlreadySelected = currentIds.includes(photoId)
  let newSelectedIds: string[] = []

  if (isAlreadySelected) {
    newSelectedIds = currentIds.filter((id) => id !== photoId)
  } else {
    if (currentIds.length >= gallery.maxPhotos) {
      return { updatedGallery: gallery, isSelected: false }
    }
    newSelectedIds = [...currentIds, photoId]
  }

  const updatedGallery: GalleryData = {
    ...gallery,
    selectedPhotoIds: newSelectedIds,
    selectedPhotos: newSelectedIds.length,
    status:
      newSelectedIds.length === 0
        ? 'Belum mulai'
        : newSelectedIds.length >= gallery.maxPhotos
        ? 'Selesai dipilih'
        : 'Sedang memilih',
  }

  const clean = (s?: string) => (s ? String(s).toLowerCase().trim() : '')
  const idx = galleries.findIndex(
    (g) => clean(g.id) === clean(gallery.id) || clean(g.slug) === clean(gallery.slug)
  )
  if (idx >= 0) {
    galleries[idx] = updatedGallery
    saveStoredGalleries(galleries)
  }

  return { updatedGallery, isSelected: !isAlreadySelected }
}
