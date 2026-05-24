import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://jayne-07.github.io/wordsearch-generator/ on GitHub Pages.
export default defineConfig({
  base: '/wordsearch-generator/',
  plugins: [react()],
});
