import './styles/globals.css';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Get initial state from server-rendered data
const initialState = window.__INITIAL_STATE__ || {};

hydrateRoot(
  document.getElementById('app'),
  <BrowserRouter>
    <App initialState={initialState} />
  </BrowserRouter>
);
