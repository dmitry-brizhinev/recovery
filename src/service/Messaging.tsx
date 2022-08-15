import type * as React from 'react'

import '../css/messaging.css';
import initialize from '../firebase/FirebaseMessaging';

export default function Messaging(): React.ReactElement {
  return <div className="message-wrapper">
    <div><button className="message-initialize" onClick={initialize}>Initialize Messaging</button></div>
  </div>;
}
