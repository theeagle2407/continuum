import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rpcUrl = env.HELIUS_RPC_URL?.trim()

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ['buffer'],
        globals: { Buffer: true },
      }),
    ],
    server: {
      proxy: {
        '/__continuum_rpc': {
          target: rpcUrl,
          changeOrigin: true,
          rewrite: () => '/',
          secure: true,
        },
        '/__continuum_prestocks': {
          target: 'https://prestocks.com',
          changeOrigin: true,
          rewrite: () => '/api/prestocks',
          secure: true,
        },
      },
    },
  }
})
