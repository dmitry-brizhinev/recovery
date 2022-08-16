/// <reference lib="webworker" />

import { getApp } from '../firebase/FirebaseCore';
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";

export function run(self: ServiceWorkerGlobalScope) {

  const messaging = getMessaging(getApp());

  onBackgroundMessage(messaging, (payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = 'Background Message Title';
    const notificationOptions = {
      body: 'Background Message body.',
      icon: '/logo192.png',
    };

    self.registration.showNotification(notificationTitle,
      notificationOptions);
  });

}