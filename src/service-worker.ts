/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import * as precaching from 'workbox-precaching'; // This defines the __WB_MANIFEST value
import { run } from './service/MessagingServiceWorker';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

const unused = self.__WB_MANIFEST; // Needed even if unused

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Any other custom service worker logic can go here.

run(self);