import { defineConfig, loadEnv } from 'vite'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Load standard Vite env (.env.local)
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Also attempt to load Mira.env.local (user-named file)
  // Vite only auto-loads .env.* files; we manually merge Mira.env.local here
  const miraEnvPath = resolve(process.cwd(), 'Mira.env.local', '.vars')
  const miraEnvFilePath = resolve(process.cwd(), '.env.local')

  return {
    // Serve from project root
    root: '.',
    // Public assets directory
    publicDir: 'public',
    server: {
      port: 5173,
      open: true,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
          dashboard: resolve(process.cwd(), 'dashboard.html')
        }
      }
    },
    // Ensure env vars are available
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  }
})
