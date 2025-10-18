import express from 'express';

const app = express();

// middlewares
app.use(express.json());

// routes
app.get('/health', (req, res) => res.json({ ok: true }));

export default app;
