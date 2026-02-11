
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carga variables desde archivos .env usando '.' como path seguro
  const env = loadEnv(mode, '.', '');
  
  // Prioriza la variable del sistema (CI/CD) o usa la del archivo .env
  const apiKey = process.env.API_KEY || env.API_KEY;

  return {
    plugins: [react()],
    define: {
      // Inyecta el valor de la API Key en tiempo de compilación
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Mantiene un objeto vacío para otras referencias a process.env para evitar crash
      'process.env': {}
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
