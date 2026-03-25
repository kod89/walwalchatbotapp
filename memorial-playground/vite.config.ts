import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:8001';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 4173,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
