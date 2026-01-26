import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';

export function render(url, initialState = {}) {
  const html = renderToString(
    <StaticRouter location={url}>
      <App initialState={initialState} />
    </StaticRouter>
  );

  // Inject initial state for client hydration
  const head = `
    <script>
      window.__INITIAL_STATE__ = ${JSON.stringify(initialState).replace(/</g, '\\u003c')};
    </script>
  `;

  return { html, head };
}
