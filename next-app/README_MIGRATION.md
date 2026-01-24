# Identity Verification — Next.js Migration

This folder contains a Next.js App Router scaffold for migrating the legacy identity verification demo.

Quick start

1. Install dependencies:

```bash
cd modules/identity/next-app
npm install
```

2. Run dev server (uses port 3001):

```bash
npm run dev
```

Notes

- Static assets (copy `server/public/*` into `next-app/public`) to preserve original scripts and CSS.
- API routes are stubs: `app/api/session`, `app/api/ocr/base64`, `app/api/verify` — adapt them to call `lib/services/*` implementations.
- Use secure context (https) locally for camera testing. Your Chocolatey approach for local HTTPS is appropriate.

Embed flow

1. Third-party app POSTs to `/api/session` with configuration.
2. Server creates a short-lived session and returns an `iframeUrl` (e.g. `/identity/embed?session=...`).
3. Third-party embeds the returned iframe URL.
4. User completes verification inside iframe; server updates session and optionally calls a configured webhook.
5. Third-party polls `/api/session/[id]/status` or listens to webhook to receive final data.

Security

- Keep all AI/OCR service calls server-side.
- Do not import server-only modules into client components.
- Enforce size limits and content checks in API routes.
