import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // The backend writes uploaded scans / the SQLite DB into these folders while the app runs.
    // Without this, Vite sees the new files and hard-reloads the page right after every upload.
    watch: {
      ignored: ['**/public/uploads/**', '**/server/**', '**/*.db', '**/*.db-wal', '**/*.db-shm', '**/_backup_*/**'],
    },
    proxy: {
      '/api': 'http://127.0.0.1:8001',
      '/uploads': 'http://127.0.0.1:8001',
    },
  },
})
