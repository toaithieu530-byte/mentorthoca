import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
    proxy: {
      '/api/chat': {
        target: 'https://text.pollinations.ai',
        changeOrigin: true,
        rewrite: () => '/openai/v1/chat/completions',
      },
      ...(process.env.ELEVENLABS_API_KEY
        ? {
            '/api/tts': {
              target: 'https://api.elevenlabs.io',
              changeOrigin: true,
              rewrite: () => '/v1/text-to-speech/jdlxsPOZOHdGEfcItXVu',
              headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                Accept: 'audio/mpeg',
              },
            },
          }
        : {}),
    },
  },
});
