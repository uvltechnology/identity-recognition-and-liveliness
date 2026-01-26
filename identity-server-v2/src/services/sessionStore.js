import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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
    console.log('[sessionStore] Connected to Redis at', redisUrl);
    return { useRedis: true, redisClient };
  } catch (e) {
    console.warn('[sessionStore] Redis not available; using in-memory sessions');
    redisClient = null;
    useRedis = false;
    return { useRedis: false, redisClient: null };
  }
}

function startInMemoryCleanup(intervalMs = 60 * 1000) {
  setInterval(() => {
    try {
      const now = Date.now();
      for (const [k, v] of verifySessions.entries()) {
        if (!v) continue;
        if (v.expiresAt && Number(v.expiresAt) > 0 && now > Number(v.expiresAt)) {
          verifySessions.delete(k);
        }
      }
    } catch (e) { /* no-op */ }
  }, intervalMs);
}

startInMemoryCleanup();

export async function getSession(id) {
  if (!id) return null;
  if (useRedis && redisClient) {
    try {
      const raw = await redisClient.get(`verify:${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[sessionStore] Redis getSession error', e);
      return verifySessions.get(id) || null;
    }
  }
  const s = verifySessions.get(id) || null;
  if (!s) return null;
  if (s.expiresAt && Number(s.expiresAt) > 0 && Date.now() > Number(s.expiresAt)) {
    verifySessions.delete(id);
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
      console.error('[sessionStore] Redis setSession error', e);
      verifySessions.set(id, sessionObj);
      return;
    }
  }
  const copy = { ...(sessionObj || {}), expiresAt: Date.now() + Number(ttlSeconds) * 1000 };
  verifySessions.set(id, copy);
}

export async function deleteSession(id) {
  if (!id) return;
  if (useRedis && redisClient) {
    try { await redisClient.del(`verify:${id}`); return; } catch (e) { console.error('[sessionStore] Redis deleteSession error', e); }
  }
  verifySessions.delete(id);
}

export function makeSessionId() {
  try { 
    return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  } catch(e) { 
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; 
  }
}

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
    if (sess?.payload) {
      imageRef = imageRef || sess.payload.tempImageRef || null;
      delete sess.payload.tempImageRef;
      delete sess.payload.tempOcr;
      await setSession(id, sess);
    }
    if (imageRef && typeof deleteImageFromStorage === 'function') {
      await deleteImageFromStorage(imageRef);
    }
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
