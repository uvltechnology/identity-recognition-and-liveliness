# Identity Server V2 (React + Vite SSR)

This is a server-side rendered (SSR) React application using Vite and Express for identity verification.

## Features

- **Server-Side Rendering**: Fast initial page loads with SEO benefits
- **React 18**: Modern React with concurrent features
- **Vite**: Fast development with HMR
- **Tailwind CSS**: Utility-first styling
- **Express**: Node.js server for SSR and API routes

## Project Structure

```
identity-server-v2/
├── index.html          # HTML template
├── server.js           # Express server with SSR
├── vite.config.js      # Vite configuration
├── tailwind.config.js  # Tailwind CSS config
├── postcss.config.js   # PostCSS config
├── package.json        # Dependencies
└── src/
    ├── entry-client.jsx  # Client-side entry (hydration)
    ├── entry-server.jsx  # Server-side entry (rendering)
    ├── App.jsx           # Main React app with routes
    ├── components/       # Reusable components
    │   ├── CameraSection.jsx
    │   ├── ConsentOverlay.jsx
    │   └── ProblemAlert.jsx
    ├── pages/            # Page components
    │   ├── HomePage.jsx
    │   └── EmbedVerification.jsx
    └── styles/
        └── globals.css   # Global styles + Tailwind
```

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This starts the server with Vite dev middleware for hot module replacement.

### Production Build

```bash
npm run build
```

This creates:
- `dist/client/` - Client-side assets
- `dist/server/` - Server-side render function

### Run Production

```bash
npm run preview
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/session/:id` - Get session information
- `GET /embed/session/:id` - Embed verification page (SSR)

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Integration

To embed the verification in an iframe:

```html
<iframe 
  src="http://localhost:3000/embed/session/YOUR_SESSION_ID"
  allow="camera"
  style="width: 100%; height: 500px; border: none;"
></iframe>
```

Listen for postMessage events:

```javascript
window.addEventListener('message', (event) => {
  if (event.data?.identityOCR) {
    const { action, reason, session } = event.data.identityOCR;
    console.log('Identity event:', action, reason);
  }
});
```
