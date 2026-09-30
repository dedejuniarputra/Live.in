/**
 * Google Drive API & Folder Scanning Helper
 * Mengambil foto langsung dari Google Drive (streaming via Drive CDN)
 * TANPA menyimpan file gambar ke storage lokal maupun Supabase storage.
 */

export interface DrivePhotoItem {
  id: string
  fileId: string
  filename: string
  url: string
  thumbnailUrl: string
  mimeType?: string
  size?: number
  aspect?: 'portrait' | 'landscape'
  category?: 'Group' | 'Keluarga' | 'Sendiri'
  isHighlight?: boolean
}

/**
 * Ekstrak folder ID dari berbagai format link Google Drive
 */
export function extractDriveFolderId(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  // Format: drive.google.com/drive/folders/FOLDER_ID
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (matchFolders && matchFolders[1]) return matchFolders[1]

  // Format: drive.google.com/open?id=FOLDER_ID atau ?id=FOLDER_ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (matchId && matchId[1]) return matchId[1]

  // Jika user langsung memasukkan folder ID
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed
  }

  return null
}

/**
 * Menghasilkan direct URL untuk stream foto langsung dari Google Drive
 */
export function getDriveDirectImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`
}

export function getDriveThumbnailUrl(fileId: string, size = 800): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`
}

/**
 * Pindai isi folder Google Drive melalui Drive scanner endpoint & API v3
 */
export async function scanGoogleDriveFolder(
  folderUrl: string,
  folderName = 'Galeri Foto'
): Promise<{
  success: boolean
  folderId: string
  folderName?: string
  photos: DrivePhotoItem[]
  source?: string
  error?: string
}> {
  const folderId = extractDriveFolderId(folderUrl) || ''

  if (!folderId) {
    return {
      success: false,
      folderId: '',
      photos: [],
      error: 'Link folder Google Drive tidak valid atau ID folder tidak ditemukan.',
    }
  }

  const envApiKey =
    (typeof window !== 'undefined'
      ? localStorage.getItem('google_drive_api_key')
      : null) ||
    import.meta.env.VITE_GOOGLE_DRIVE_API_KEY ||
    ''

  // 1. Coba scan melalui backend scanner endpoint /api/scan-drive
  try {
    const scanEndpoint = `/api/scan-drive?folderUrl=${encodeURIComponent(
      folderUrl
    )}&apiKey=${encodeURIComponent(envApiKey)}`

    const res = await fetch(scanEndpoint)
    if (res.ok) {
      const data = await res.json()
      if (data.success && data.photos && data.photos.length > 0) {
        console.log(`[Google Drive] Berhasil memindai ${data.photos.length} foto dari folder Google Drive asli via ${data.source}`)
        return {
          success: true,
          folderId: data.folderId || folderId,
          folderName: data.folderName || '',
          photos: data.photos,
          source: data.source,
        }
      } else if (data.error) {
        return {
          success: false,
          folderId,
          photos: [],
          error: data.error,
        }
      }
    }
  } catch (err) {
    console.warn('[Google Drive] Endpoint scan drive error:', err)
  }

  // 2. Direct client-side fetch jika Google Drive API Key tersedia di frontend (rekursif subfolder)
  if (envApiKey && folderId && !folderId.startsWith('drive_')) {
    try {
      const cleanKey = envApiKey.trim()
      const allPhotos: DrivePhotoItem[] = []
      const queue: Array<{ id: string; category?: 'Keluarga' | 'Group' | 'Sendiri' }> = [
        { id: folderId },
      ]
      const visited = new Set<string>()

      while (queue.length > 0 && allPhotos.length < 2000) {
        const current = queue.shift()!
        if (visited.has(current.id)) continue
        visited.add(current.id)

        const q = encodeURIComponent(`'${current.id}' in parents and trashed = false`)
        const fields = encodeURIComponent(
          'nextPageToken, files(id, name, mimeType, size, thumbnailLink, imageMediaMetadata)'
        )

        let pageToken = ''
        do {
          const endpoint = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${cleanKey}&pageSize=100${
            pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
          }`

          const res = await fetch(endpoint)
          if (!res.ok) break
          const data = await res.json()
          if (data.files && Array.isArray(data.files)) {
            for (const file of data.files) {
              if (file.mimeType === 'application/vnd.google-apps.folder') {
                const lower = (file.name || '').toLowerCase()
                const subCat: 'Keluarga' | 'Group' | 'Sendiri' =
                  lower.includes('keluarga') || lower.includes('kelurga')
                    ? 'Keluarga'
                    : lower.includes('group') || lower.includes('grup')
                    ? 'Group'
                    : 'Sendiri'
                queue.push({ id: file.id, category: subCat })
              } else {
                const isImage =
                  file.mimeType?.startsWith('image/') ||
                  Boolean(file.imageMediaMetadata) ||
                  /\.(jpe?g|png|webp|heic|raw|cr2|cr3|nef|arw|dng)$/i.test(file.name || '')
                if (isImage) {
                  const w = Number(file.imageMediaMetadata?.width) || 0
                  const h = Number(file.imageMediaMetadata?.height) || 0
                  const aspect =
                    w > 0 && h > 0
                      ? w >= h
                        ? 'landscape'
                        : 'portrait'
                      : allPhotos.length % 3 === 0
                      ? 'landscape'
                      : 'portrait'

                  allPhotos.push({
                    id: file.id,
                    fileId: file.id,
                    filename: file.name || `FOTO_${String(allPhotos.length + 1).padStart(4, '0')}.JPG`,
                    url: getDriveDirectImageUrl(file.id),
                    thumbnailUrl: getDriveThumbnailUrl(file.id, 800),
                    mimeType: file.mimeType,
                    size: file.size ? Number(file.size) : undefined,
                    aspect,
                    category: current.category || (allPhotos.length % 3 === 0 ? 'Keluarga' : allPhotos.length % 3 === 1 ? 'Group' : 'Sendiri'),
                    isHighlight: allPhotos.length < 5,
                  })
                }
              }
            }
          }
          pageToken = data.nextPageToken || ''
        } while (pageToken && allPhotos.length < 2000)
      }

      if (allPhotos.length > 0) {
        return { success: true, folderId, photos: allPhotos, source: 'client-api' }
      }
    } catch (err) {
      console.warn('Direct Google Drive API failed', err)
    }
  }

  // 3. Jika folder belum bisa terbaca, beritahu bahwa folder Google Drive harus berstatus publik
  // "Siapa saja yang memiliki link dapat melihat" atau masukkan API Key Google Drive
  return {
    success: false,
    folderId,
    photos: [],
    error:
      'Folder Google Drive tidak dapat dibaca. Pastikan hak akses folder diset ke: "Siapa saja yang memiliki link" -> "Pelihat" (Public view access), atau masukkan Google Drive API Key.',
  }
}
