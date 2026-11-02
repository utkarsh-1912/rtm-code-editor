import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { installAuthFetch } from './utils/authFetch';

// Sign-in token on every API request (the server no longer trusts user ids sent by the page).
installAuthFetch();

window.React = React;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
