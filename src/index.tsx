import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './core/Header';
import reportWebVitals from './reportWebVitals';

import './css/index.css';
import './css/pages.css';
import 'react-calendar/dist/Calendar.css';
import './css/events.css';
import './css/calendar.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
