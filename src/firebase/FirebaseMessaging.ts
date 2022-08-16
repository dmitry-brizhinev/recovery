import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getRegistration } from "../service/RegisterServiceWorker";
import { getApp } from "./FirebaseCore";

export default async function initialize() {
  const messaging = getMessaging(getApp());

  try {

  const registration = await getRegistration();

  if (!registration) {
    console.log('No registered service worker available');
    return;
  }

  const currentToken = await getToken(messaging, {
    vapidKey: 'BC_-17zekJUwRk4Migm7Y9lyNPHvBmu70KQ1qFMkmhbxu-54NovXbdrDpgIkgD-mj9ANoezY1mwBAEb_HusM5no',
    serviceWorkerRegistration: registration,
  });

  if (currentToken) {
    // Send the token to your server and update the UI if necessary
    console.log('Got token', currentToken);
    // After you've obtained the token, send it to your app server and store it using your preferred method
    // f5Xm9BA2QXwtn3Li10EUoa:APA91bEpmfwEjOcrh5sNLl0JeUQFXGXEJk1KGxjGsDkNQlyPc6hh84jdvlWafXcc4CdINAJcdTZ-POMYxDgNRjERLZnkGmY9TUwV-iebQ3Y-f2eg-FUTmE6KBFBk6CivX2fTENaM2f6R
  } else {
    // Show permission request UI
    console.log('No registration token available. Request permission to generate one.');
    requestPermission();
  }

  } catch(err) {
    console.log('An error occurred while retrieving token. ', err);
  }


  function requestPermission() {
    console.log('Requesting permission...');
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      }
    });
  }

  onMessage(messaging, (payload) => {
    console.log('Message received. ', payload);
    // ...
  });
}