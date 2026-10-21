import { defineConfig, loadEnv } from 'vite'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createAiDevMiddleware } from './server/dev-middleware.js'

export default defineConfig(({ mode }) => {
  // Load standard Vite env (.env.local) and populate process.env for server middleware
  const env = loadEnv(mode, process.cwd(), '')
  for (const key in env) {
    if (!process.env[key]) {
      process.env[key] = env[key]
    }
  }

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
    plugins: [
      {
        name: 'vite-ai-api-plugin',
        configureServer(server) {
          server.middlewares.use(createAiDevMiddleware())
        }
      }
    ],
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
