import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',     // 👈 VERY IMPORTANT
    port: process.env.PORT || 5173, // 👈 Use PORT provided by Render
  },
})
