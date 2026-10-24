import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Tudo que começar com /api é repassado para o backend (pasta server/)
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
})
