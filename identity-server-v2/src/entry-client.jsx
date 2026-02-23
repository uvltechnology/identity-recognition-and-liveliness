import './styles/globals.css';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Get initial state from server-rendered data
const initialState = window.__INITIAL_STATE__ || {};

// Inject expected origin for embed parent checking (set via Vite env `VITE_EXPECTED_ORIGIN`)
try {
  // prefer Vite-provided env var, fall back to any define we injected
  window.__IDENTITY_EXPECTED_ORIGIN__ = import.meta.env.VITE_EXPECTED_ORIGIN || (typeof __VITE_EXPECTED_ORIGIN__ !== 'undefined' ? __VITE_EXPECTED_ORIGIN__ : window.__IDENTITY_EXPECTED_ORIGIN__ || '*');
} catch (e) {
  window.__IDENTITY_EXPECTED_ORIGIN__ = window.__IDENTITY_EXPECTED_ORIGIN__ || '*';
}

hydrateRoot(
  document.getElementById('app'),
  <BrowserRouter>
    <App initialState={initialState} />
  </BrowserRouter>
);
