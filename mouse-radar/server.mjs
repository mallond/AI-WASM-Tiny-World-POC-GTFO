// server.mjs
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ logger: true });

// Permissive CORS for all non-SSE routes (demo)
await app.register(cors, { origin: true });

// Serve the dashboard + demo spy page
await app.register(fastifyStatic, { root: join(__dirname, 'public') });

// In-memory state per "room"
const rooms = new Map(); // room -> { clients:Set<res>, lastSeen: Map<sessionId, ts> }
function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { clients: new Set(), lastSeen: new Map() });
  return rooms.get(name);
}

// SSE subscription for mouse points (ALLOW ALL CORS on the stream)
// SSE subscription for mouse points (ALLOW ALL, hard-coded via writeHead)
app.get('/events/mouse', async (req, reply) => {
  const { room = 'default' } = req.query ?? {};
  const r = getRoom(room);

  // IMPORTANT: writeHead with ACAO before any body bytes
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',      // <-- allow all for demo
    // Do NOT add Access-Control-Allow-Credentials with "*"
    // 'X-Accel-Buffering': 'no', // if behind nginx
  });

  // optional hello
  reply.raw.write(`event: hello\n`);
  reply.raw.write(`data: {"room":"${room}"}\n\n`);

  // keep-alive
  const hb = setInterval(() => {
    try { reply.raw.write(`:ping\n\n`); } catch {}
  }, 15000);

  // track client
  r.clients.add(reply.raw);
  req.raw.on('close', () => {
    clearInterval(hb);
    r.clients.delete(reply.raw);
  });
});

// Start spy session
app.post('/spy/start', async (req, reply) => {
  const { room = 'default' } = req.query ?? {};
  const sessionId = randomUUID();
  reply.send({ sessionId, room });
});

// Spy heartbeat
app.post('/spy/ping', async (req, reply) => {
  try {
    const { sessionId, room = 'default' } = req.body ?? {};
    if (sessionId) getRoom(room).lastSeen.set(sessionId, Date.now());
    reply.send({ ok: true });
  } catch {
    reply.code(400).send({ ok: false });
  }
});

// Spy sends batched points
app.post('/spy/batch', async (req, reply) => {
  try {
    const { sessionId, room = 'default', points = [] } = req.body ?? {};
    if (!sessionId || !Array.isArray(points) || points.length === 0) {
      return reply.code(400).send({ ok: false, error: 'bad payload' });
    }
    const r = getRoom(room);
    r.lastSeen.set(sessionId, Date.now());

    const frame =
      `event: point\n` +
      `data: ${JSON.stringify({ sessionId, points })}\n\n`;

    for (const res of r.clients) {
      try { res.write(frame); } catch {}
    }
    reply.send({ ok: true });
  } catch (e) {
    reply.code(500).send({ ok: false, error: String(e) });
  }
});

// Dashboard stats
app.get('/mouse/stats', async (req, reply) => {
  const { room = 'default' } = req.query ?? {};
  const r = getRoom(room);
  const now = Date.now();
  let active = 0;
  for (const t of r.lastSeen.values()) if (now - t < 20000) active++;
  reply.send({ room, viewers: r.clients.size, activeSpies: active });
});

// Root: quick links
app.get('/', async (req, reply) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const origin = `${url.protocol}//${req.headers.host}`;
  reply.type('text/html').send(`<!doctype html>
    <meta charset="utf-8">
    <title>Mouse Radar</title>
    <body style="font:16px system-ui; padding:24px;">
      <h1>Mouse Radar</h1>
      <p>Open these:</p>
      <ul>
        <li><a href="/dashboard.html">Dashboard</a></li>
        <li><a href="/spy.html" target="_blank">Spy demo page</a></li>
      </ul>
      <p>To embed the tracker on any page, paste the script from <code>public/spy-snippet.js</code> and set <code>BASE</code> to <code>${origin}</code> (or your ngrok URL).</p>
    </body>`);
});

const port = process.env.PORT || 8090;
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`Server on http://localhost:${port}`);
}).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
