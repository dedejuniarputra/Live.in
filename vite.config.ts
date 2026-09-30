import { defineConfig, loadEnv, type Plugin } from 'vite'
import process from 'node:process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function getCategoryFromName(name: string, fallbackIndex = 0): 'Keluarga' | 'Group' | 'Sendiri' {
  const lower = name.toLowerCase()
  if (lower.includes('keluarga') || lower.includes('kelurga') || lower.includes('family')) {
    return 'Keluarga'
  }
  if (lower.includes('group') || lower.includes('grup') || lower.includes('rombongan') || lower.includes('teman')) {
    return 'Group'
  }
  if (lower.includes('sendiri') || lower.includes('solo') || lower.includes('single') || lower.includes('individu')) {
    return 'Sendiri'
  }
  return fallbackIndex % 3 === 0 ? 'Keluarga' : fallbackIndex % 3 === 1 ? 'Group' : 'Sendiri'
}

function driveScannerPlugin(defaultApiKey = ''): Plugin {
  return {
    name: 'drive-scanner-plugin',
    configureServer(server) {
      server.middlewares.use('/api/scan-drive', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost:5173')
          const folderUrl = urlObj.searchParams.get('folderUrl') || ''
          const apiKey =
            urlObj.searchParams.get('apiKey')?.trim() ||
            defaultApiKey.trim() ||
            (process.env.VITE_GOOGLE_DRIVE_API_KEY || '').trim()

          // Extract folderId from link
          let folderId = ''
          const matchFolders = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/)
          if (matchFolders && matchFolders[1]) {
            folderId = matchFolders[1]
          } else {
            const matchId = folderUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/)
            if (matchId && matchId[1]) {
              folderId = matchId[1]
            } else if (/^[a-zA-Z0-9_-]{25,}$/.test(folderUrl.trim())) {
              folderId = folderUrl.trim()
            }
          }

          if (!folderId) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                success: false,
                error: 'Folder ID tidak valid dari link yang dimasukkan.',
              })
            )
            return
          }

          console.log(`[Drive Scanner] Memindai folder ID: ${folderId} (API Key: ${apiKey ? 'Tersedia' : 'Tidak Ada'})`)

          // 0. Dukungan untuk testing / demo link
          if (folderId.includes('sample') || folderId.includes('demo')) {
            const demoPhotos = Array.from({ length: 24 }).map((_, i) => {
              const num = 101 + i
              const demoUrls = [
                'https://images.unsplash.com/photo-1511285560929-80b456fea0bc',
                'https://images.unsplash.com/photo-1583939003579-730e3918a45a',
                'https://images.unsplash.com/photo-1520854221256-17451cc331bf',
                'https://images.unsplash.com/photo-1606800052052-a08af7148866',
                'https://images.unsplash.com/photo-1519741497674-611481863552',
                'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8',
                'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf',
                'https://images.unsplash.com/photo-1522673607200-164d1b6ce486',
              ]
              const base = demoUrls[i % demoUrls.length]
              return {
                id: `demo-file-${num}`,
                fileId: `demo_drive_${num}`,
                filename: `DSC_${String(num).padStart(4, '0')}.JPG`,
                url: `${base}?auto=format&fit=crop&w=1600&q=80`,
                thumbnailUrl: `${base}?auto=format&fit=crop&w=600&q=80`,
                aspect: i % 2 === 0 ? 'landscape' : 'portrait',
                category: i % 3 === 0 ? 'Keluarga' : i % 3 === 1 ? 'Group' : 'Sendiri',
                isHighlight: i < 5,
              }
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({
                success: true,
                folderId,
                folderName: 'Wisuda & Wedding Demo Folder',
                photos: demoPhotos,
                source: 'demo-sample',
              })
            )
            return
          }

          // 1. Prioritas 1: Gunakan Google Drive API v3 jika API Key tersedia (rekursif membaca subfolder)
          if (apiKey) {
            try {
              const cleanKey = apiKey.trim()
              let folderName = ''
              try {
                const folderRes = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&key=${cleanKey}`
                )
                if (folderRes.ok) {
                  const fData = (await folderRes.json()) as { name?: string }
                  if (fData?.name) folderName = fData.name
                }
              } catch (_) {}

              const allPhotos: any[] = []
              const queue: Array<{ id: string; category?: 'Keluarga' | 'Group' | 'Sendiri' }> = [
                { id: folderId },
              ]
              const visitedFolders = new Set<string>()

              while (queue.length > 0 && allPhotos.length < 2000) {
                const current = queue.shift()!
                if (visitedFolders.has(current.id)) continue
                visitedFolders.add(current.id)

                const q = encodeURIComponent(`'${current.id}' in parents and trashed = false`)
                const fields = encodeURIComponent(
                  'nextPageToken, files(id, name, mimeType, size, thumbnailLink, imageMediaMetadata)'
                )

                let pageToken = ''
                do {
                  const endpoint = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&key=${cleanKey}&pageSize=100${
                    pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
                  }`
                  const apiRes = await fetch(endpoint)
                  if (!apiRes.ok) {
                    const errText = await apiRes.text().catch(() => '')
                    console.warn(`[Drive Scanner] Google Drive API files.list error (status ${apiRes.status}):`, errText)
                    break
                  }
                  const data = (await apiRes.json()) as {
                    files?: any[]
                    nextPageToken?: string
                  }
                  if (data.files && Array.isArray(data.files)) {
                    for (const item of data.files) {
                      if (item.mimeType === 'application/vnd.google-apps.folder') {
                        // Jika item adalah subfolder, masukkan ke antrean dengan kategori sesuai nama folder
                        const subCat = getCategoryFromName(item.name || '', queue.length)
                        queue.push({ id: item.id, category: subCat })
                      } else {
                        // Cek apakah item adalah file foto
                        const isImage =
                          item.mimeType?.startsWith('image/') ||
                          Boolean(item.imageMediaMetadata) ||
                          /\.(jpe?g|png|webp|heic|raw|cr2|cr3|nef|arw|dng)$/i.test(item.name || '')
                        if (isImage) {
                          const w = Number(item.imageMediaMetadata?.width) || 0
                          const h = Number(item.imageMediaMetadata?.height) || 0
                          const aspect =
                            w > 0 && h > 0
                              ? w >= h
                                ? 'landscape'
                                : 'portrait'
                              : allPhotos.length % 3 === 0
                              ? 'landscape'
                              : 'portrait'

                          allPhotos.push({
                            id: item.id,
                            fileId: item.id,
                            filename: item.name || `FOTO_${String(allPhotos.length + 1).padStart(4, '0')}.JPG`,
                            url: `https://lh3.googleusercontent.com/d/${item.id}`,
                            thumbnailUrl: `https://drive.google.com/thumbnail?id=${item.id}&sz=w800`,
                            mimeType: item.mimeType,
                            size: item.size ? Number(item.size) : undefined,
                            aspect,
                            category: current.category || getCategoryFromName(item.name || '', allPhotos.length),
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
                console.log(`[Drive Scanner] Berhasil membaca ${allPhotos.length} foto via Google Drive API (termasuk subfolder)!`)
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, folderId, folderName, photos: allPhotos, source: 'drive-api' }))
                return
              }
            } catch (apiErr: any) {
              console.warn('[Drive Scanner] API Exception:', apiErr.message)
            }
          }

          // 2. Prioritas 2: Coba ekstrak file dari embeddedfolderview Google Drive publik (rekursif membaca subfolder)
          const allEmbedPhotos: any[] = []
          const embedQueue: Array<{ id: string; category?: 'Keluarga' | 'Group' | 'Sendiri' }> = [
            { id: folderId },
          ]
          const visitedEmbed = new Set<string>()
          let detectedFolderName = ''

          while (embedQueue.length > 0 && allEmbedPhotos.length < 2000) {
            const currentFolder = embedQueue.shift()!
            if (visitedEmbed.has(currentFolder.id)) continue
            visitedEmbed.add(currentFolder.id)

            const embedUrl = `https://drive.google.com/embeddedfolderview?id=${currentFolder.id}#grid`
            const embedRes = await fetch(embedUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
            })

            if (!embedRes.ok) continue
            const embedHtml = await embedRes.text()

            if (!detectedFolderName && currentFolder.id === folderId) {
              const titleMatch = embedHtml.match(/<title>([^<]+) - Google Drive<\/title>/i)
              if (titleMatch && titleMatch[1]) {
                detectedFolderName = titleMatch[1].trim()
              }
            }

            // Regex pola flip-entry pada embeddedfolderview
            const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"([\s\S]*?)<div class="flip-entry-title">([^<]+)<\/div>/g
            let match: RegExpExecArray | null
            let entriesFound = 0

            while ((match = entryRegex.exec(embedHtml)) !== null) {
              entriesFound++
              const entryId = match[1]
              const entryBlock = match[2]
              const entryTitle = match[3].trim()

              // Cek apakah item ini adalah folder
              const isFolder =
                entryBlock.includes('icon-folder') ||
                entryBlock.includes('flip-entry-folder') ||
                entryBlock.includes('folder') ||
                !/\.(jpe?g|png|webp|heic|raw|cr2|cr3|nef|arw|dng)$/i.test(entryTitle)

              if (isFolder) {
                // Masukkan subfolder ke antrean untuk dipindai isinya!
                const subCat = getCategoryFromName(entryTitle, embedQueue.length)
                embedQueue.push({ id: entryId, category: subCat })
              } else {
                allEmbedPhotos.push({
                  id: entryId,
                  fileId: entryId,
                  filename: entryTitle,
                  url: `https://lh3.googleusercontent.com/d/${entryId}`,
                  thumbnailUrl: `https://drive.google.com/thumbnail?id=${entryId}&sz=w800`,
                  aspect: allEmbedPhotos.length % 3 === 0 ? 'landscape' : 'portrait',
                  category: currentFolder.category || getCategoryFromName(entryTitle, allEmbedPhotos.length),
                  isHighlight: allEmbedPhotos.length < 5,
                })
              }
            }

            // Regex alternatif jika format flip-entry berbeda: cari thumbnail ID
            if (entriesFound === 0) {
              const thumbRegex = /thumbnail\?id=([a-zA-Z0-9_-]+)/g
              let thumbMatch: RegExpExecArray | null
              const seenThumbIds = new Set<string>()
              while ((thumbMatch = thumbRegex.exec(embedHtml)) !== null) {
                const fileId = thumbMatch[1]
                if (fileId !== currentFolder.id && !seenThumbIds.has(fileId)) {
                  seenThumbIds.add(fileId)
                  allEmbedPhotos.push({
                    id: fileId,
                    fileId,
                    filename: `FOTO_${String(allEmbedPhotos.length + 1).padStart(4, '0')}.JPG`,
                    url: `https://lh3.googleusercontent.com/d/${fileId}`,
                    thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
                    aspect: allEmbedPhotos.length % 3 === 0 ? 'landscape' : 'portrait',
                    category: currentFolder.category || (allEmbedPhotos.length % 3 === 0 ? 'Keluarga' : allEmbedPhotos.length % 3 === 1 ? 'Group' : 'Sendiri'),
                    isHighlight: allEmbedPhotos.length < 5,
                  })
                }
              }
            }
          }

          if (allEmbedPhotos.length > 0) {
            console.log(`[Drive Scanner] Berhasil membaca ${allEmbedPhotos.length} foto via Google Drive Embedded View (termasuk subfolder)!`)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, folderId, folderName: detectedFolderName, photos: allEmbedPhotos, source: 'embed-view' }))
            return
          }

          // 3. Jika belum ditemukan foto: folder mungkin private atau butuh API Key
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              success: false,
              folderId,
              message:
                'Tidak dapat membaca foto di folder Google Drive. Pastikan folder disetel ke: "Siapa saja yang memiliki link" -> "Pelihat", atau masukkan Google Drive API Key Anda.',
            })
          )
        } catch (error: any) {
          console.error('[Drive Scanner Error]:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: error.message }))
        }
      })

      // Download proxy endpoint to allow direct photo download with original filename
      server.middlewares.use('/api/download-photo', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost:5173')
          const fileId = urlObj.searchParams.get('id') || ''
          const rawUrl = urlObj.searchParams.get('url') || ''
          const filename = urlObj.searchParams.get('filename') || 'photo.jpg'

          let targetUrl = fileId
            ? `https://drive.google.com/uc?export=download&id=${fileId}`
            : rawUrl

          if (!targetUrl) {
            res.statusCode = 400
            res.end('Missing URL or fileId')
            return
          }

          let fetchRes = await fetch(targetUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          })

          if (!fetchRes.ok && fileId) {
            // Fallback to lh3 CDN
            targetUrl = `https://lh3.googleusercontent.com/d/${fileId}`
            fetchRes = await fetch(targetUrl)
          }

          if (!fetchRes.ok) {
            res.statusCode = 502
            res.end('Failed to fetch image stream')
            return
          }

          res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
          res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg')
          const arrayBuf = await fetchRes.arrayBuffer()
          res.end(Buffer.from(arrayBuf))
        } catch (error: any) {
          console.error('[Download Photo Error]:', error)
          res.statusCode = 500
          res.end('Failed to download photo')
        }
      })

      // Image streaming proxy endpoint to reliably display Google Drive images on frontend
      server.middlewares.use('/api/drive-image', async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost:5173')
          const fileId = urlObj.searchParams.get('id') || ''
          const size = urlObj.searchParams.get('sz') || '800'
          if (!fileId) {
            res.statusCode = 400
            res.end('Missing fileId')
            return
          }

          // 1. Try public thumbnail endpoint
          let fetchRes = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`)

          // 2. Fallback to Google Drive API media stream if API Key exists
          if (!fetchRes.ok && defaultApiKey) {
            fetchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${defaultApiKey}`)
          }

          // 3. Fallback to lh3 CDN
          if (!fetchRes.ok) {
            fetchRes = await fetch(`https://lh3.googleusercontent.com/d/${fileId}`)
          }

          if (!fetchRes.ok) {
            res.statusCode = 502
            res.end('Failed to fetch image')
            return
          }

          res.setHeader('Content-Type', fetchRes.headers.get('content-type') || 'image/jpeg')
          res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
          const arrayBuf = await fetchRes.arrayBuffer()
          res.end(Buffer.from(arrayBuf))
        } catch (error: any) {
          console.error('[Drive Image Proxy Error]:', error)
          res.statusCode = 500
          res.end('Failed to fetch image')
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const driveApiKey = env.VITE_GOOGLE_DRIVE_API_KEY || ''

  return {
    plugins: [
      react(),
      tailwindcss(),
      driveScannerPlugin(driveApiKey),
    ],
  }
})