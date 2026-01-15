import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

window.addEventListener('error', (event) => {
    window.api?.logError?.({ message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error?.stack });
});

window.addEventListener('unhandledrejection', (event) => {
    window.api?.logError?.({ message: 'Unhandled Rejection', error: event.reason });
});

import { DateRangeProvider } from './context/DateRangeContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <DateRangeProvider>
       <App />
    </DateRangeProvider>
  </React.StrictMode>
);
