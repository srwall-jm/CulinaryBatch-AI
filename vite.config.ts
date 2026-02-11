
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Esto permite que process.env.API_KEY funcione si defines la variable de entorno en Cloudflare
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Fallback seguro para otras llamadas a process.env
      'process.env': {}
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
