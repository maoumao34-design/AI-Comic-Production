import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 后端未就绪时前端用内置 mock（VITE_USE_MOCK=true，默认）；
// 后端就绪后设 VITE_USE_MOCK=false 并用 VITE_API_BASE 指向后端 /api/v1。
// base：默认 '/'。GitHub Pages 项目站点需带子路径，构建时用 VITE_BASE 指定
// 例：VITE_BASE=/AI-Comic-Production/ npm run build
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 开发时把 /api 转到本机后端，产物图 img src=/api/v1/artifacts?... 才能加载
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: { host: true, port: 4173 },
})
