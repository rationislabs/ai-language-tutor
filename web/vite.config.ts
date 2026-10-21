import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  preview: { allowedHosts: [".ts.net"] }, // the private phone test over Tailscale (README)
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Listening Tutor",
        short_name: "Tutor",
        description: "Learn German, Hungarian, French and Italian by listening",
        theme_color: "#1f6f5c",
        background_color: "#fbfaf7",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/content/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "content" },
          },
          {
            // iOS asks for audio in ranges: serve 206 answers from the cache.
            urlPattern: ({ url }) => url.pathname.includes("/audio/"),
            handler: "CacheFirst",
            options: {
              cacheName: "audio",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
