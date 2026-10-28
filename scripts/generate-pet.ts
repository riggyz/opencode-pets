import sharp from "sharp"
import { writeFile } from "node:fs/promises"

// Original pixel cat, rendered into the same atlas format consumed by Codex.
// Coordinates use a 48×52 logical grid, scaled 4× without smoothing.
const rect = (x: number, y: number, w: number, h: number, fill: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const ink = "#252a36", fur = "#596275", light = "#8590a4", mint = "#a1f0cb"
const frames: string[] = []
for (let row = 0; row < 9; row++) {
  for (let frame = 0; frame < 8; frame++) {
    const wave = Math.sin(frame * Math.PI / 4)
    const running = row === 1 || row === 2 || row === 7
    const jumping = row === 4
    const bob = jumping ? -Math.round(Math.abs(wave) * 9) : running ? -(frame % 2) : frame < 4 ? 0 : -1
    const blink = frame === 6 || row === 6
    const body = [
      rect(12, 42, 26, 2, "#1a1e2930"),
      `<g transform="translate(0 ${bob})">`,
      rect(32, 28, 8, 5, ink), rect(37, 23 + Math.round(wave * 2), 5, 9, ink),
      rect(33, 29, 6, 2, fur),
      rect(15, 26, 19, 14, ink), rect(17, 27, 15, 11, fur),
      rect(19, 28, 8, 9, light),
      rect(14, running && frame % 2 ? 37 : 39, 7, 4, ink),
      rect(28, running && !(frame % 2) ? 37 : 39, 7, 4, ink),
      rect(11, 10, 7, 12, ink), rect(29, 10, 7, 12, ink),
      rect(13, 13, 3, 6, "#eaa7b1"), rect(31, 13, 3, 6, "#eaa7b1"),
      rect(10, 18, 27, 13, ink), rect(13, 16, 21, 17, ink),
      rect(13, 19, 21, 10, fur), rect(16, 17, 15, 14, fur),
      rect(14, 22, 7, blink ? 1 : 4, row === 5 ? "#ffb0aa" : mint),
      rect(27, 22, 6, blink ? 1 : 4, row === 5 ? "#ffb0aa" : mint),
      ...(!blink ? [rect(18, 22, 2, 3, ink), rect(28, 22, 2, 3, ink)] : []),
      rect(23, 27, 2, 2, "#eaa7b1"), rect(21, 30, 6, 1, ink),
      ...(row === 3 ? [rect(8, 23 - Math.round(wave * 3), 5, 8, ink), rect(9, 24 - Math.round(wave * 3), 3, 3, light)] : []),
      ...(row === 8 ? [rect(30, 31, 8, 7, "#d4c4a1"), rect(33, 32, 1, 5, ink)] : []),
      ...(row === 5 ? [rect(38, 13, 2, 6, "#ffb0aa"), rect(38, 21, 2, 2, "#ffb0aa")] : []),
      ...(row === 6 ? [rect(33, 5 - frame % 3, 4, 1, mint), rect(35, 6 - frame % 3, 1, 2, mint), rect(33, 8 - frame % 3, 4, 1, mint)] : []),
      `</g>`,
    ].join("")
    frames.push(`<g transform="translate(${frame * 192} ${row * 208}) scale(4)">${row === 2 ? `<g transform="translate(48 0) scale(-1 1)">${body}</g>` : body}</g>`)
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1872" shape-rendering="crispEdges">${frames.join("")}</svg>`
await writeFile(new URL("../assets/byte/spritesheet.png", import.meta.url), await sharp(Buffer.from(svg)).png().toBuffer())
