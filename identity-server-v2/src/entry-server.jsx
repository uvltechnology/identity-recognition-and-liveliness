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
  let head = `
    <script>
      window.__INITIAL_STATE__ = ${JSON.stringify(initialState).replace(/</g, '\u003c')};
    </script>
  `;

  // Inject expected origin for embeds (KYC: restrict parent origins)
  const expectedOrigin = process.env.VITE_EXPECTED_ORIGIN || process.env.IDENTITY_EXPECTED_ORIGIN || '';
  const originScript = `
    <script>
      window.__IDENTITY_EXPECTED_ORIGIN__ = ${JSON.stringify(expectedOrigin || '*')};
    </script>
  `;

  head += originScript;

  return { html, head };
}
