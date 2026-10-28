import { readFile, readdir, realpath, stat } from "node:fs/promises"
import { join, relative, isAbsolute, extname } from "node:path"
import { parseManifest, rowCount, type Catalog, type Pet } from "./pet"

const MAX_BYTES = 20 * 1024 * 1024

export function imageSize(image: Buffer): { width: number; height: number } {
  if (image.length >= 24 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) }
  }
  if (image.toString("ascii", 0, 4) !== "RIFF" || image.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid PNG/WebP image")
  for (let offset = 12; offset + 8 <= image.length;) {
    const type = image.toString("ascii", offset, offset + 4)
    const size = image.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > image.length) break
    if (type === "VP8X" && size >= 10) return { width: image.readUIntLE(start + 4, 3) + 1, height: image.readUIntLE(start + 7, 3) + 1 }
    if (type === "VP8 " && size >= 10) return { width: image.readUInt16LE(start + 6) & 0x3fff, height: image.readUInt16LE(start + 8) & 0x3fff }
    if (type === "VP8L" && size >= 5 && image[start] === 0x2f) {
      const bits = image.readUInt32LE(start + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    offset = start + size + (size % 2)
  }
  throw new Error("Invalid WebP dimensions")
}

export async function loadPet(folder: string, source: string): Promise<Pet> {
  const manifestPath = join(folder, "pet.json")
  if ((await stat(manifestPath)).size > 64 * 1024) throw new Error("pet.json is too large")
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")))
  const root = await realpath(folder)
  const imagePath = await realpath(join(root, manifest.spritesheetPath))
  const path = relative(root, imagePath)
  if (path === ".." || path.startsWith("../") || isAbsolute(path)) throw new Error("Spritesheet resolves outside the pet folder")
  if ((await stat(imagePath)).size > MAX_BYTES) throw new Error("Spritesheet exceeds 20 MiB")
  const image = await readFile(imagePath)
  const png = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const webp = image.toString("ascii", 0, 4) === "RIFF" && image.toString("ascii", 8, 12) === "WEBP"
  if (!(extname(imagePath).toLowerCase() === ".png" ? png : webp)) throw new Error("Invalid PNG/WebP image")
  const dimensions = imageSize(image)
  if (dimensions.width !== 1536 || dimensions.height !== rowCount(manifest.spriteVersionNumber) * 208) throw new Error(`Invalid atlas dimensions: expected 1536 × ${rowCount(manifest.spriteVersionNumber) * 208}`)
  return { ...manifest, key: root, source, image: `data:image/${png ? "png" : "webp"};base64,${image.toString("base64")}` }
}

export async function loadCatalog(directories: string[]): Promise<Catalog> {
  const result: Catalog = { pets: [], errors: [] }
  for (const directory of [...new Set(directories)]) {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") result.errors.push(`${directory}: ${error.message}`)
      return []
    })
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue
      try {
        const pet = await loadPet(join(directory, entry.name), directory)
        if (!result.pets.some(existing => existing.key === pet.key)) result.pets.push(pet)
      } catch (error) {
        result.errors.push(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  return result
}
