import { parseManifest, type Pet } from "./pet"
import byte from "../assets/byte/pet.json"
import byteImage from "../assets/byte/spritesheet.png?inline"
import euromoji from "../assets/euromoji/pet.json"
import euromojiImage from "../assets/euromoji/spritesheet.webp?inline"
import shrocket from "../assets/shrocket/pet.json"
import shrocketImage from "../assets/shrocket/spritesheet.webp?inline"
import thurmble from "../assets/thurmble/pet.json"
import thurmbleImage from "../assets/thurmble/spritesheet.webp?inline"
import unicorn from "../assets/unicorn/pet.json"
import unicornImage from "../assets/unicorn/spritesheet.webp?inline"

// Inline images ship in the GUI bundle, so installed packages need no filesystem
// access or network requests to display their default pets.
export const builtins: Pet[] = [
  { manifest: byte, image: byteImage },
  { manifest: euromoji, image: euromojiImage },
  { manifest: shrocket, image: shrocketImage },
  { manifest: thurmble, image: thurmbleImage },
  { manifest: unicorn, image: unicornImage },
].map(({ manifest, image }) => ({ ...parseManifest(manifest), key: `builtin:${manifest.id}`, source: "Built in", image }))
