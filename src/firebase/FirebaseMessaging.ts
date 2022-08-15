import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./FirebaseCore";

export default function initialize() {
  const messaging = getMessaging(app);

  // TODO: tell the getToken() call about the service worker!!
  getToken(messaging, {vapidKey: 'BC_-17zekJUwRk4Migm7Y9lyNPHvBmu70KQ1qFMkmhbxu-54NovXbdrDpgIkgD-mj9ANoezY1mwBAEb_HusM5no'}).then((currentToken) => {
    if (currentToken) {
      // Send the token to your server and update the UI if necessary
      console.log('Got token', currentToken);
      // After you've obtained the token, send it to your app server and store it using your preferred method
      // dUTbH9woNYJDXCI5UiU1zc:APA91bG3uMHBculHzpD6O9yk943v6QSE-69PzIhYXOfLlr3fQQkJujwl-MlHZabIncDPDNw9ZqVbDTK2sNMESJSyCI663kRMAJ4gK2zRzjzuDtFeOL_XrtcffFBkZqBMbEXf5_mdiEd4
      // cqSwTI2nkBcWUb9JWINmCm:APA91bFw9OBO_pZ3xqPfyfglcNee0igu110rfxSE8_OPOcRgWNhzzoLiyZzUOVQurDojQHI17HLcpEOXJE_L15TBX7X0PO28YJchQxzhyY-lE3wRUoKr5eraG-eNowj00ltvO2kXiOgm
    } else {
      // Show permission request UI
      console.log('No registration token available. Request permission to generate one.');
    }
  }).catch((err) => {
    console.log('An error occurred while retrieving token. ', err);
  });


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