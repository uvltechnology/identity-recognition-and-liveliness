import mysql from 'mysql2/promise';

// Database connection pool
let pool = null;

const getPool = async () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'identity_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

// Initialize webhook tables
export async function initWebhookTables() {
  try {
    const db = await getPool();
    
    // Create webhooks table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(255) NOT NULL UNIQUE,
        session_type ENUM('id', 'selfie', 'combined') NOT NULL DEFAULT 'id',
        webhook_url VARCHAR(500),
        success_url VARCHAR(500),
        failure_url VARCHAR(500),
        status ENUM('pending', 'processing', 'success', 'failed', 'expired') DEFAULT 'pending',
        verification_data JSON,
        attempts INT DEFAULT 0,
        last_attempt DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_session_id (session_id),
        INDEX idx_status (status)
      )
    `);

    // Create webhook events table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webhook_id INT,
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        payload JSON,
        response_status INT,
        response_body TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session (session_id),
        INDEX idx_event_type (event_type)
      )
    `);

    console.log('✓ Webhook tables initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize webhook tables:', error.message);
    return false;
  }
}

// Register a webhook for a session
export async function registerWebhook({ sessionId, sessionType, webhookUrl, successUrl, failureUrl }) {
  try {
    const db = await getPool();
    
    // Check if webhook already exists
    const [existing] = await db.execute(
      'SELECT id FROM webhooks WHERE session_id = ?',
      [sessionId]
    );

    if (existing.length > 0) {
      // Update existing webhook
      await db.execute(
        `UPDATE webhooks SET 
          session_type = ?, webhook_url = ?, success_url = ?, failure_url = ?, updated_at = NOW()
         WHERE session_id = ?`,
        [sessionType || 'id', webhookUrl, successUrl, failureUrl, sessionId]
      );
      return { success: true, webhookId: existing[0].id, updated: true };
    }

    // Insert new webhook
    const [result] = await db.execute(
      `INSERT INTO webhooks (session_id, session_type, webhook_url, success_url, failure_url) 
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, sessionType || 'id', webhookUrl, successUrl, failureUrl]
    );

    return { success: true, webhookId: result.insertId };
  } catch (error) {
    console.error('Webhook registration error:', error.message);
    return { success: false, error: error.message };
  }
}

// Get webhook by session ID
export async function getWebhookBySession(sessionId) {
  try {
    const db = await getPool();
    const [rows] = await db.execute(
      'SELECT * FROM webhooks WHERE session_id = ?',
      [sessionId]
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Get webhook error:', error.message);
    return null;
  }
}

// Update webhook status
export async function updateWebhookStatus(sessionId, status, verificationData = null) {
  try {
    const db = await getPool();
    await db.execute(
      `UPDATE webhooks SET status = ?, verification_data = ?, updated_at = NOW() WHERE session_id = ?`,
      [status, JSON.stringify(verificationData), sessionId]
    );
    return { success: true };
  } catch (error) {
    console.error('Update webhook status error:', error.message);
    return { success: false, error: error.message };
  }
}

// Log webhook event
export async function logWebhookEvent({ sessionId, eventType, payload, responseStatus, responseBody }) {
  try {
    const db = await getPool();
    
    // Get webhook ID
    const [webhooks] = await db.execute(
      'SELECT id FROM webhooks WHERE session_id = ?',
      [sessionId]
    );
    const webhookId = webhooks[0]?.id || null;

    await db.execute(
      `INSERT INTO webhook_events (webhook_id, session_id, event_type, payload, response_status, response_body)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [webhookId, sessionId, eventType, JSON.stringify(payload), responseStatus, responseBody]
    );
    return { success: true };
  } catch (error) {
    console.error('Log webhook event error:', error.message);
    return { success: false };
  }
}

// Send webhook notification with retry
export async function sendWebhookNotification(sessionId, eventType, data, retries = 3) {
  const webhook = await getWebhookBySession(sessionId);
  if (!webhook || !webhook.webhook_url) {
    console.log(`[Webhook] No webhook URL for session ${sessionId}`);
    return { success: false, error: 'No webhook URL configured' };
  }

  const payload = {
    event: eventType,
    sessionId: webhook.session_id,
    sessionType: webhook.session_type,
    status: eventType.split('.')[1], // 'success' or 'failed' from 'verification.success'
    data,
    timestamp: new Date().toISOString()
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Update attempt count
      const db = await getPool();
      await db.execute(
        'UPDATE webhooks SET attempts = attempts + 1, last_attempt = NOW() WHERE session_id = ?',
        [sessionId]
      );

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventType,
          'X-Session-Id': sessionId,
          'X-Attempt': String(attempt)
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const responseBody = await response.text();

      await logWebhookEvent({
        sessionId,
        eventType: response.ok ? 'webhook.sent' : 'webhook.failed',
        payload,
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000)
      });

      if (response.ok) {
        console.log(`[Webhook] Sent ${eventType} for ${sessionId} (attempt ${attempt})`);
        return { success: true, status: response.status };
      }

      console.warn(`[Webhook] Attempt ${attempt} failed with status ${response.status}`);
    } catch (error) {
      console.error(`[Webhook] Attempt ${attempt} error:`, error.message);
      
      await logWebhookEvent({
        sessionId,
        eventType: 'webhook.error',
        payload,
        responseStatus: 0,
        responseBody: error.message
      });
    }

    // Wait before retry (exponential backoff)
    if (attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

// Trigger verification success
export async function triggerVerificationSuccess(sessionId, verificationData = {}) {
  const webhook = await getWebhookBySession(sessionId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found for session' };
  }

  // Update status
  await updateWebhookStatus(sessionId, 'success', verificationData);

  // Log event
  await logWebhookEvent({
    sessionId,
    eventType: 'verification.success',
    payload: verificationData,
    responseStatus: null,
    responseBody: null
  });

  // Send webhook notification
  if (webhook.webhook_url) {
    await sendWebhookNotification(sessionId, 'verification.success', verificationData);
  }

  return {
    success: true,
    redirectUrl: webhook.success_url ? `${webhook.success_url}?sessionId=${sessionId}` : null,
    sessionId
  };
}

// Trigger verification failed
export async function triggerVerificationFailed(sessionId, reason = 'Verification failed', verificationData = {}) {
  const webhook = await getWebhookBySession(sessionId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found for session' };
  }

  const data = { ...verificationData, reason };

  // Update status
  await updateWebhookStatus(sessionId, 'failed', data);

  // Log event
  await logWebhookEvent({
    sessionId,
    eventType: 'verification.failed',
    payload: data,
    responseStatus: null,
    responseBody: null
  });

  // Send webhook notification
  if (webhook.webhook_url) {
    await sendWebhookNotification(sessionId, 'verification.failed', data);
  }

  return {
    success: true,
    redirectUrl: webhook.failure_url ? `${webhook.failure_url}?sessionId=${sessionId}&reason=${encodeURIComponent(reason)}` : null,
    sessionId,
    reason
  };
}

// Trigger session expired
export async function triggerSessionExpired(sessionId) {
  const webhook = await getWebhookBySession(sessionId);
  if (!webhook) {
    return { success: false, error: 'Webhook not found for session' };
  }

  await updateWebhookStatus(sessionId, 'expired', { reason: 'Session expired' });

  await logWebhookEvent({
    sessionId,
    eventType: 'verification.expired',
    payload: { reason: 'Session expired' },
    responseStatus: null,
    responseBody: null
  });

  if (webhook.webhook_url) {
    await sendWebhookNotification(sessionId, 'verification.expired', { reason: 'Session expired' });
  }

  return { success: true, sessionId };
}

// Get webhook status with events
export async function getWebhookStatus(sessionId) {
  try {
    const db = await getPool();
    
    const webhook = await getWebhookBySession(sessionId);
    if (!webhook) return null;

    const [events] = await db.execute(
      'SELECT * FROM webhook_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 50',
      [sessionId]
    );

    return { ...webhook, events };
  } catch (error) {
    console.error('Get webhook status error:', error.message);
    return null;
  }
}

// List all webhooks with pagination
export async function listWebhooks(page = 1, limit = 20) {
  try {
    const db = await getPool();
    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      'SELECT * FROM webhooks ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [String(limit), String(offset)]
    );

    const [countResult] = await db.execute('SELECT COUNT(*) as total FROM webhooks');

    return {
      success: true,
      data: rows,
      total: countResult[0].total,
      page,
      limit
    };
  } catch (error) {
    console.error('List webhooks error:', error.message);
    return { success: false, data: [], total: 0, page, limit };
  }
}

export default {
  initWebhookTables,
  registerWebhook,
  getWebhookBySession,
  updateWebhookStatus,
  logWebhookEvent,
  sendWebhookNotification,
  triggerVerificationSuccess,
  triggerVerificationFailed,
  triggerSessionExpired,
  getWebhookStatus,
  listWebhooks
};
