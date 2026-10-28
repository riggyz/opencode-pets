import { defineConfig } from "vite"
import { gui } from "@opencode/plugin/gui/vite"
import solid from "vite-plugin-solid"

export default defineConfig(({ command }) => ({
  plugins: command === "build" ? [gui()] : [solid()],
}))
