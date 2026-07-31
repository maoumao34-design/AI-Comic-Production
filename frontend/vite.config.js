import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 后端未就绪时前端用内置 mock（VITE_USE_MOCK=true，默认）；
// 后端就绪后设 VITE_USE_MOCK=false 并用 VITE_API_BASE 指向后端 /api/v1。
export default defineConfig({
    plugins: [react()],
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
});
