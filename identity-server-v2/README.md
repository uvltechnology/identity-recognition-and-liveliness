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

### Health & Sessions
- `GET /api/health` - Health check
- `GET /api/verify/session/:id` - Get session information
- `POST /api/verify/session/:id/result` - Update session result

### Session Creation

#### ID Verification Session
```bash
POST /api/verify/id/create
Content-Type: application/json

{
  "idType": "national-id",
  "webhookUrl": "https://yoursite.com/webhook",
  "successUrl": "https://yoursite.com/success",
  "failureUrl": "https://yoursite.com/failure",
  "ttlSeconds": 3600
}
```

#### Selfie Liveness Session
```bash
POST /api/verify/selfie/create
Content-Type: application/json

{
  "webhookUrl": "https://yoursite.com/webhook",
  "ttlSeconds": 3600
}
```

#### Combined Verification Session (ID + Selfie)
```bash
POST /api/verify/combined/create
Content-Type: application/json

{
  "idType": "national-id",
  "compareFaces": true,
  "webhookUrl": "https://yoursite.com/webhook",
  "successUrl": "https://yoursite.com/success",
  "failureUrl": "https://yoursite.com/failure",
  "ttlSeconds": 3600
}
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `idType` | string | `"national-id"` | Type of ID to verify (see ID Types below) |
| `compareFaces` | boolean | `true` | If `false`, skips face comparison between ID photo and selfie |
| `webhookUrl` | string | - | URL to receive verification result webhook |
| `successUrl` | string | - | Redirect URL on success |
| `failureUrl` | string | - | Redirect URL on failure |
| `ttlSeconds` | number | `3600` | Session time-to-live in seconds |

**Supported ID Types:**
- `national-id` - Philippine National ID
- `driver-license` - Driver's License
- `passport` - Passport
- `umid` - UMID
- `philhealth` - PhilHealth ID
- `tin-id` - TIN ID
- `postal-id` - Postal ID
- `pagibig` - Pag-IBIG ID

### OCR Endpoint
```bash
POST /api/ocr/base64
Content-Type: application/json

{
  "image": "<base64-encoded-image>",
  "type": "identity",
  "idType": "national-id"
}
```

## Verification Pages

| Route | Description |
|-------|-------------|
| `/session/id/:sessionId` | ID verification only |
| `/session/selfieliveness/:sessionId` | Selfie liveness only |
| `/session/combined/:sessionId` | Combined ID + Selfie verification |
| `/embed/session/:sessionId` | Embeddable verification page |

## Liveness Detection

The selfie verification uses **eye blink detection** for liveness:
- User must blink once to prove liveness
- Uses Eye Aspect Ratio (EAR) algorithm with face landmarks
- Threshold: EAR < 0.22 indicates closed eyes
- Requires 1 complete blink (eyes open → closed → open)

**Why eye blink?**
- More natural and user-friendly than expressions
- Works reliably across different lighting conditions
- Harder to spoof with static photos

## Face Comparison

When `compareFaces: true` (default), the system:
1. Extracts face descriptor from ID photo
2. Extracts face descriptor from selfie
3. Calculates Euclidean distance between descriptors
4. Match threshold: distance < 0.70 (70% similarity)

Set `compareFaces: false` to skip this step (useful for testing or when face matching isn't required).

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
    const { action, reason, session, result } = event.data.identityOCR;
    console.log('Identity event:', action, reason);
    
    // Possible actions:
    // - 'verification_success' - Verification completed successfully
    // - 'verification_failed' - Verification failed
    // - 'verification_cancelled' - User cancelled
    // - 'verification_complete' - User clicked Done
  }
});
```

## Webhook Payload

On verification completion, the webhook receives:

```json
{
  "sessionId": "abc123",
  "status": "done",
  "result": {
    "action": "success",
    "idData": {
      "fullName": "JUAN DELA CRUZ",
      "firstName": "JUAN",
      "lastName": "DELA CRUZ",
      "dateOfBirth": "1990-01-15",
      "idNumber": "1234-5678-9012"
    },
    "idImage": "<base64>",
    "selfieImage": "<base64>",
    "livenessScore": 100,
    "faceComparisonPerformed": true,
    "faceMatched": true,
    "faceSimilarity": 85,
    "timestamp": "2026-01-30T10:00:00.000Z"
  },
  "finishedAt": "2026-01-30T10:00:05.000Z"
}
```
