/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { run } from './service/MessagingServiceWorker';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

if (`self.__WB_MANIFEST`.length < 0) (0 as any).x=0;  // The string 'self.__WB_MANIFEST' needs to be in the file (post-compilation) even if unused

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Any other custom service worker logic can go here.

run(self);