// public/spy-snippet.js
// Drop-in tracker. Include with: <script src="https://<your-host>/spy-snippet.js" defer></script>
(async () => {
  const BASE = window.__MOUSE_RADAR_BASE__ || 'http://localhost:8090'; // same-origin by default
  const params = new URLSearchParams(location.search);
  const room = params.get('room') || 'default';

  async function start() {
    const res = await fetch(`${BASE}/spy/start?room=${encodeURIComponent(room)}`, { method:'POST' });
    if (!res.ok) throw new Error('start failed');
    return res.json();
  }

  const { sessionId } = await start();

  const buf = [];
  let lastSent = 0;
  const MAX_HZ = 30, MIN_INTERVAL = 1000 / MAX_HZ;

  function enqueueLike(e) {
    const now = performance.now();
    buf.push({ t: now, x: e.clientX, y: e.clientY, vw: innerWidth, vh: innerHeight });
    if (now - lastSent >= MIN_INTERVAL) {
      lastSent = now;
      flush(false);
    }
  }

  addEventListener('mousemove', enqueueLike, { passive: true });
  addEventListener('touchmove', (e) => {
    const t = e.touches && e.touches[0]; if (!t) return;
    enqueueLike({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });

  function flush(final) {
    if (!buf.length) return;
    const payload = JSON.stringify({ sessionId, room, points: buf.splice(0) });
    if (final && navigator.sendBeacon) {
      navigator.sendBeacon(`${BASE}/spy/batch`, payload);
    } else {
      fetch(`${BASE}/spy/batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  }

  // heartbeat
  const hb = setInterval(() => {
    fetch(`${BASE}/spy/ping`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId, room, t: performance.now() }),
      keepalive: true
    }).catch(() => {});
  }, 15000);

  addEventListener('visibilitychange', () => { if (document.hidden) flush(false); });
  addEventListener('beforeunload', () => { clearInterval(hb); flush(true); });
})();
