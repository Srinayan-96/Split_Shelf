import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Your backend only allows http://localhost:5173 (CLIENT_URL). If that port were
  // busy and Vite silently picked 5174, every request would fail with a CORS error.
  // strictPort makes Vite stop instead, so the problem is obvious.
  server: { port: 5173, strictPort: true },
});
