import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  site: 'https://agentpki.dev',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        allow: [path.resolve('.'), path.resolve('..')],
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
});
