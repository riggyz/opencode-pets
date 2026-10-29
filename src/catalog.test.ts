import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { imageSize, loadCatalog, loadPet } from "./catalog"
import { actions, frameCounts } from "./pet"

const image = await readFile(new URL("../assets/byte/spritesheet.png", import.meta.url))
const manifest = { id: "test-cat", displayName: "Test Cat", spritesheetPath: "spritesheet.png" }

test("loads the bundled original as a real Codex pet folder", async () => {
  const pet = await loadPet(new URL("../assets/byte/", import.meta.url).pathname, "test")
  assert.equal(pet.id, "byte")
  assert.match(pet.image, /^data:image\/png;base64,/)
  assert.deepEqual(imageSize(image), { width: 1536, height: 1872 })
})

test("all five built-in pet folders have valid manifests and decodable atlases", async () => {
  const catalog = await loadCatalog([new URL("../assets/", import.meta.url).pathname])
  assert.deepEqual(catalog.errors, [])
  assert.deepEqual(catalog.pets.map(pet => pet.id), ["byte", "euromoji", "shrocket", "thurmble", "unicorn"])
  assert.equal(new Set(catalog.pets.map(pet => pet.id)).size, 5)
  for (const pet of catalog.pets) {
    assert.equal(pet.spriteVersionNumber, pet.id === "byte" ? 1 : 2)
    const bytes = Buffer.from(pet.image.split(",")[1], "base64")
    const metadata = await sharp(bytes).metadata()
    assert.equal(metadata.width, 1536)
    assert.equal(metadata.height, pet.id === "byte" ? 1872 : 2288)
    assert.equal(metadata.hasAlpha, true)
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const cells = actions.flatMap((action, row) => Array.from({ length: frameCounts[action] }, (_, column) => ({ row, column })))
    if (pet.spriteVersionNumber === 2) cells.push(...Array.from({ length: 16 }, (_, index) => ({ row: 9 + Math.floor(index / 8), column: index % 8 })))
    for (const { row, column } of cells) {
      let visible = false
      for (let y = row * 208; y < (row + 1) * 208 && !visible; y++) {
        for (let x = column * 192; x < (column + 1) * 192; x++) {
          if (data[(y * info.width + x) * 4 + 3] > 0) { visible = true; break }
        }
      }
      assert.ok(visible, `${pet.id}: blank animation cell at row ${row}, column ${column}`)
    }
  }
})

test("catalog tolerates missing roots, isolates bad pets, deduplicates, and blocks symlink escapes", async () => {
  const root = await mkdtemp(join(tmpdir(), "opencode-pets-test-"))
  try {
    const pets = join(root, "pets")
    for (const name of ["good", "bad", "escape"]) await mkdir(join(pets, name), { recursive: true })
    await writeFile(join(pets, "good", "pet.json"), JSON.stringify(manifest))
    await writeFile(join(pets, "good", "spritesheet.png"), image)
    await writeFile(join(pets, "bad", "pet.json"), "{broken")
    await writeFile(join(pets, "escape", "pet.json"), JSON.stringify(manifest))
    await writeFile(join(root, "outside.png"), image)
    await symlink(join(root, "outside.png"), join(pets, "escape", "spritesheet.png"))
    const catalog = await loadCatalog([join(root, "missing"), pets, pets])
    assert.equal(catalog.pets.length, 1)
    assert.equal(catalog.errors.length, 2)
    assert.ok(catalog.errors.some(error => error.includes("outside the pet folder")))
    assert.equal(catalog.pets[0].displayName, "Test Cat")
    await writeFile(join(pets, "good", "spritesheet.png"), "not an image")
    await assert.rejects(loadPet(join(pets, "good"), "test"), /Invalid PNG/)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("accepts Codex v1/v2 PNG and WebP atlases, rejects incorrect dimensions", async () => {
  const root = await mkdtemp(join(tmpdir(), "opencode-pets-image-"))
  try {
    for (const height of [1872, 2288]) {
      const version = height === 1872 ? 1 : 2
      const raw = sharp({ create: { width: 1536, height, channels: 4, background: "transparent" } })
      const buffers = [await raw.clone().png().toBuffer(), await raw.clone().webp().toBuffer(), await raw.clone().webp({ lossless: true }).toBuffer()]
      for (const [index, data] of buffers.entries()) {
        const path = `spritesheet.${index === 0 ? "png" : "webp"}`
        await writeFile(join(root, "pet.json"), JSON.stringify({ ...manifest, spritesheetPath: path, spriteVersionNumber: version }))
        await writeFile(join(root, path), data)
        assert.deepEqual(imageSize(data), { width: 1536, height })
        assert.equal((await loadPet(root, "test")).spriteVersionNumber, version)
      }
    }
    await writeFile(join(root, "pet.json"), JSON.stringify(manifest))
    await writeFile(join(root, "spritesheet.png"), await sharp({ create: { width: 8, height: 9, channels: 4, background: "transparent" } }).png().toBuffer())
    await assert.rejects(loadPet(root, "test"), /Invalid atlas dimensions/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
