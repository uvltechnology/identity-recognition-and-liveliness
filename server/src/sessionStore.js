import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Lightweight session store wrapper. Uses Redis when configured (client provided by caller via env)
// and falls back to an in-memory Map with TTL semantics.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let redisClient = null;
let useRedis = false;
const verifySessions = new Map();

export async function initRedisClient(createClient, redisUrl) {
  try {
    if (!redisUrl) return { useRedis: false, redisClient: null };
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('Redis client error', err));
    await redisClient.connect();
    useRedis = true;
    console.log('[identity/sessionStore] Connected to Redis at', redisUrl);
    return { useRedis: true, redisClient };
  } catch (e) {
    console.warn('[identity/sessionStore] Redis not configured or not available; using in-memory sessions');
    redisClient = null;
    useRedis = false;
    return { useRedis: false, redisClient: null };
  }
}

// Periodic cleanup for expired in-memory sessions (when Redis is not used)
function startInMemoryCleanup(intervalMs = 60 * 1000) {
  setInterval(() => {
    try {
      const now = Date.now();
      for (const [k, v] of verifySessions.entries()) {
        if (!v) continue;
        if (v.expiresAt && Number(v.expiresAt) > 0 && now > Number(v.expiresAt)) {
          try { verifySessions.delete(k); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* no-op */ }
  }, intervalMs);
}

// Start cleanup immediately for in-memory mode
startInMemoryCleanup();

export async function getSession(id) {
  if (!id) return null;
  if (useRedis && redisClient) {
    try {
      const raw = await redisClient.get(`verify:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[identity/sessionStore] Redis getSession error', e);
      return verifySessions.get(id) || null;
    }
  }
  const s = verifySessions.get(id) || null;
  if (!s) return null;
  if (s.expiresAt && Number(s.expiresAt) > 0 && Date.now() > Number(s.expiresAt)) {
    try { verifySessions.delete(id); } catch (e) { /* ignore */ }
    return null;
  }
  return s;
}

export async function setSession(id, sessionObj, ttlSeconds = 60 * 60) {
  if (!id) return;
  if (useRedis && redisClient) {
    try {
      await redisClient.set(`verify:${id}`, JSON.stringify(sessionObj), { EX: ttlSeconds });
      return;
    } catch (e) {
      console.error('[identity/sessionStore] Redis setSession error', e);
      verifySessions.set(id, sessionObj);
      return;
    }
  }
  try {
    const copy = { ...(sessionObj || {}) };
    copy.expiresAt = Date.now() + Number(ttlSeconds) * 1000;
    verifySessions.set(id, copy);
  } catch (e) {
    verifySessions.set(id, sessionObj);
  }
}

export async function deleteSession(id) {
  if (!id) return;
  if (useRedis && redisClient) {
    try { await redisClient.del(`verify:${id}`); return; } catch (e) { console.error('[identity/sessionStore] Redis deleteSession error', e); }
  }
  verifySessions.delete(id);
}

export function makeSessionId() {
  try { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  catch(e) { return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
}

// Cleanup helper: remove any temporary references and stored images for a session (will be used by app logic)
export async function cleanupTempForSession(id, { deleteImageFromStorage } = {}) {
  if (!id) return;
  try {
    let imageRef = null;
    if (useRedis && redisClient) {
      try {
        const raw = await redisClient.get(`verify:image_ref:${id}`);
        imageRef = raw ? JSON.parse(raw) : null;
        await redisClient.del(`verify:image_ref:${id}`);
        await redisClient.del(`verify:ocr:${id}`);
      } catch (e) { /* ignore */ }
    }
    const sess = await getSession(id);
    if (sess && sess.payload) {
      try {
        imageRef = imageRef || sess.payload.tempImageRef || null;
        delete sess.payload.tempImageRef;
        delete sess.payload.tempOcr;
        await setSession(id, sess);
      } catch (e) { /* ignore */ }
    }

    try {
      if (imageRef && typeof deleteImageFromStorage === 'function') await deleteImageFromStorage(imageRef);
    } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }
}

export default {
  initRedisClient,
  getSession,
  setSession,
  deleteSession,
  makeSessionId,
  cleanupTempForSession
};
