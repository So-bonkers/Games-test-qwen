import { defineConfig } from 'vite'

// Hardcoded absolute path to src directory (handles spaces in path)
const SRC_PATH = '/home/shubhankar/Desktop/games-test/subway surfers/src'

export default defineConfig({
  resolve: {
    alias: {
      '@': SRC_PATH,
    },
  },
})
