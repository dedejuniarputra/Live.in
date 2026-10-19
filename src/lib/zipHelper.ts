/**
 * Zero-dependency client-side ZIP generator (ZIP Store format, Method 0).
 * Menggabungkan banyak file foto menjadi satu file .zip standar tanpa dependensi eksternal.
 * Kompatibel dengan Windows File Explorer, macOS Archive Utility, Linux, Android, iOS.
 */

function makeCrcTable(): Uint32Array {
  let c: number
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
}

const crcTable = makeCrcTable()

export function crc32(data: Uint8Array): number {
  let crc = 0 ^ -1
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

export interface ZipFileInput {
  name: string
  data: Uint8Array
}

export function createZipBlob(files: ZipFileInput[]): Blob {
  const encoder = new TextEncoder()
  const fileRecords: {
    nameBytes: Uint8Array
    crc: number
    size: number
    offset: number
  }[] = []

  const parts: Uint8Array[] = []
  let offset = 0

  const now = new Date()
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate()

  // 1. Local File Headers + File Data
  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = file.data
    const crc = crc32(dataBytes)
    const size = dataBytes.length

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const view = new DataView(localHeader.buffer)

    view.setUint32(0, 0x04034b50, true) // Signature
    view.setUint16(4, 20, true) // Version needed: 2.0
    view.setUint16(6, 0x0800, true) // UTF-8 flag
    view.setUint16(8, 0, true) // Compression method: 0 (Store)
    view.setUint16(10, dosTime, true) // Mod time
    view.setUint16(12, dosDate, true) // Mod date
    view.setUint32(14, crc, true) // CRC32
    view.setUint32(18, size, true) // Compressed size
    view.setUint32(22, size, true) // Uncompressed size
    view.setUint16(26, nameBytes.length, true) // Filename length
    view.setUint16(28, 0, true) // Extra field length
    localHeader.set(nameBytes, 30)

    parts.push(localHeader)
    parts.push(dataBytes)

    fileRecords.push({
      nameBytes,
      crc,
      size,
      offset,
    })

    offset += localHeader.length + dataBytes.length
  }

  // 2. Central Directory Headers
  const cdOffset = offset
  let cdSize = 0

  for (const rec of fileRecords) {
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length)
    const view = new DataView(cdHeader.buffer)

    view.setUint32(0, 0x02014b50, true) // Signature
    view.setUint16(4, 20, true) // Version made by: 2.0
    view.setUint16(6, 20, true) // Version needed: 2.0
    view.setUint16(8, 0x0800, true) // UTF-8 flag
    view.setUint16(10, 0, true) // Compression method: Store (0)
    view.setUint16(12, dosTime, true) // Mod time
    view.setUint16(14, dosDate, true) // Mod date
    view.setUint32(16, rec.crc, true) // CRC32
    view.setUint32(20, rec.size, true) // Compressed size
    view.setUint32(24, rec.size, true) // Uncompressed size
    view.setUint16(28, rec.nameBytes.length, true) // Filename length
    view.setUint16(30, 0, true) // Extra field length
    view.setUint16(32, 0, true) // Comment length
    view.setUint16(34, 0, true) // Disk number start
    view.setUint16(36, 0, true) // Internal attributes
    view.setUint32(38, 0, true) // External attributes
    view.setUint32(42, rec.offset, true) // Relative offset of local header
    cdHeader.set(rec.nameBytes, 46)

    parts.push(cdHeader)
    cdSize += cdHeader.length
  }

  // 3. End of Central Directory (EOCD)
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true) // Signature
  eocdView.setUint16(4, 0, true) // Disk number
  eocdView.setUint16(6, 0, true) // Disk with start of CD
  eocdView.setUint16(8, files.length, true) // Number of entries on disk
  eocdView.setUint16(10, files.length, true) // Total entries
  eocdView.setUint32(12, cdSize, true) // Size of central directory
  eocdView.setUint32(16, cdOffset, true) // Offset of central directory
  eocdView.setUint16(20, 0, true) // Comment length

  parts.push(eocd)

  return new Blob(parts as unknown as BlobPart[], { type: 'application/zip' })
}
