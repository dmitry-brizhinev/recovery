import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './core/App';
import register from './service/RegisterServiceWorker';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

register();
