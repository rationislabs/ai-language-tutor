/** The service worker's cache for recordings (used in vite.config.ts). */
export const AUDIO_CACHE = {
  cacheName: "audio",
  rangeRequests: true,
  cacheableResponse: { statuses: [0, 200] },
  // By count only, least recently used first: Workbox counts maxAgeSeconds from the
  // download, not the last use, so an age limit would silence a learner offline for long.
  // 2000 covers one or two languages (the site has about 3700 recordings in all).
  expiration: { maxEntries: 2000 },
};
