/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const gitSha = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(gitSha) },
  // Task 18: cloudflared forwards `Host: <random>.trycloudflare.com`, which
  // `vite preview` rejects by default (Vite >=6.0.9 host-header allowlist).
  preview: { allowedHosts: ['.trycloudflare.com'] },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Plan Dnia',
        short_name: 'Plan Dnia',
        description: 'Kalendarz i lista zadań',
        lang: 'pl',
        display: 'standalone',
        start_url: '.',
        background_color: '#ffffff',
        theme_color: '#4a6fa5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/unit/**/*.test.ts'] },
});
