import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://contratos.sistema.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
      '/serpro-api': {
        target: 'https://cnbs.estaleiro.serpro.gov.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/serpro-api/, ''),
        secure: false,
      }
    }
  }
})
