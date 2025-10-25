# Mouse Radar (SSE + Spy)
Live, multi-user mouse trails using Server-Sent Events.

## Quickstart

1) **Prereq:** Node.js 18+
2) Install deps:
   ```bash
   npm install
   ```
3) Run:
   ```bash
   npm start
   ```
   Server logs: `http://localhost:3000`

4) (Optional) Expose with ngrok (or similar):
   ```bash
   ngrok http 3000
   ```
   Copy the HTTPS forwarding URL.

5) Open the **dashboard** and **spy** pages:
   - Local:
     - Dashboard: `http://localhost:3000/dashboard.html`
     - Spy page:  `http://localhost:3000/spy.html`
   - Via ngrok (replace `<ngrok>`):
     - Dashboard: `https://<ngrok>/dashboard.html`
     - Spy page:  `https://<ngrok>/spy.html`

6) To embed the spy on ANY site:
   - Host `spy-snippet.js` at your API origin.
   - On your page, set the base (if cross-origin) and include the script:
     ```html
     <script>window.__MOUSE_RADAR_BASE__='https://<your-api-origin>';</script>
     <script src="https://<your-api-origin>/spy-snippet.js" defer></script>
     ```
   - Optionally add `?room=my-room` to segregate dashboards/streams.

## Endpoints
- `GET  /events/mouse?room=` — SSE stream of `{sessionId, points[]}` frames.
- `POST /spy/start?room=`    — returns `{ sessionId, room }`.
- `POST /spy/batch`          — body `{ sessionId, room, points[] }`.
- `POST /spy/ping`           — body `{ sessionId, room }` heartbeat.
- `GET  /mouse/stats?room=`  — `{ room, viewers, activeSpies }` for HUDs.

## Notes
- Heartbeats (`:ping`) every 15s keep intermediaries from closing the stream.
- In-memory only. For production, replace the `rooms` map with Redis/NATS for pub/sub and add auth.
- Privacy: do not deploy this without consent and clear disclosure.

## License
MIT

# Mouse Radar (Spy + SSE Dashboard)

Live, multi-user mouse trails streamed from any web page to a dashboard using **Server-Sent Events (SSE)**.
Drop a tiny “spy” script on a page → the server aggregates points → the dashboard draws colored, fading trails in real time.

---

## 🎯 What is this?

A minimal observability toy that shows where people are pointing/moving on a page, in real time.
It’s built to demonstrate **HTTP/3 push alternatives**: we use **SSE (server → client)** and simple **batched POSTs (client → server)** instead of deprecated/unsupported HTTP/2/3 server push.

---

## 🧭 Quickstart

```bash
# 1) Node.js 18+ (or 20+)
cd mouse-radar
npm install

# 2) run it
npm start
# → http://localhost:3000

# 3) open these:
# Dashboard
http://localhost:3000/dashboard.html

# Spy demo page (move the mouse!)
http://localhost:3000/spy.html
```

Optional: expose to the internet for remote devices

```bash
ngrok http 3000
# Use your https://<subdomain>.ngrok.io for the dashboard and spy page
```

---

## 🏗️ Architecture (high level)

```
┌───────────────┐        batched POST /spy/batch        ┌──────────────┐
│   Spy Page    │ ─────────────────────────────────────> │    Server    │
│ (any website) │  points: [{x,y,t,vw,vh}, ...]         │  (Fastify)   │
└───────────────┘                                       └─────┬────────┘
                 heartbeat /spy/ping                              │
                                                                  │ SSE /events/mouse
                                                                  ▼
                                                          ┌──────────────┐
                                                          │  Dashboard   │
                                                          │ (EventSource)│
                                                          └──────────────┘
```

* **Spy**: captures mouse/touch points (throttled, normalized), batches them, and POSTs to the server.
* **Server**: receives batches, updates in-memory room state, and **fan-outs** them via SSE.
* **Dashboard**: subscribes to an SSE stream, assigns a color per session, and draws trails on a `<canvas>`.

---

## 🔧 Tech stack

* **Fastify** — fast Node HTTP server.
* **@fastify/cors** — lets the spy be embedded cross-origin.
* **@fastify/static** — serves the dashboard & demo pages.
* **SSE (Server-Sent Events)** — unidirectional server→browser stream (EventSource API).
* **EventSource API** — built-in browser client for SSE; auto-reconnect with `Last-Event-ID`.
* **TransformStream / Node streams** — writing SSE frames as they’re produced.
* **Canvas 2D** — smooth, fading trails per user.
* **Batched telemetry** — cut overhead by sending ~10–20 points per POST.
* **Viewport normalization** — spy attaches `vw/vh` so the dashboard can map points to its canvas size.

---

## 🗂️ Project layout

```
server.mjs                 # Fastify app + SSE endpoints
public/
  dashboard.html           # Live drawing canvas + HUD
  spy.html                 # Demo page that runs the spy
  spy-snippet.js           # Drop-in tracker for any site
package.json
README.md
```

---

## 🔌 Endpoints

* `GET  /events/mouse?room=<id>`
  **SSE** stream. Emits:

  * `event: hello` — initial hello `{room}`
  * `event: point` — `{ sessionId, points: [{x,y,t,vw,vh}, ...] }`
  * heartbeats: `:ping` every ~15s

* `POST /spy/start?room=<id>`
  Returns `{ sessionId, room }`. The spy calls this once.

* `POST /spy/batch`
  Body: `{ sessionId, room, points: [...] }` (array of normalized points).

* `POST /spy/ping`
  Body: `{ sessionId, room }` (heartbeat so the server can show “active spies”).

* `GET  /mouse/stats?room=<id>`
  Returns `{ room, viewers, activeSpies }` for the dashboard HUD.

---

## 🕵️ The spy script

`public/spy-snippet.js` is a **drop-in tracker** you can use anywhere:

```html
<!-- same-origin -->
<script src="/spy-snippet.js" defer></script>

<!-- cross-origin (e.g., on another site) -->
<script>window.__MOUSE_RADAR_BASE__='https://<your-api-origin>';</script>
<script src="https://<your-api-origin>/spy-snippet.js" defer></script>
```

What it does:

* Calls `/spy/start` to get a `sessionId`.
* Listens to `mousemove` and `touchmove`.
* Batches points at ~30 Hz, POSTs to `/spy/batch`.
* Sends `sendBeacon` on page unload for a clean tail.
* Heartbeats every 15s to keep an “active” count fresh.

**Normalization:** each point includes `vw`/`vh` (client viewport).
The dashboard scales points so different device sizes overlay correctly.

---

## 🖥️ The dashboard

* Connects to `/events/mouse?room=default` with `EventSource`.
* Assigns a unique color per `sessionId`.
* Draws a fading path and a dot at the “head”.
* HUD shows connected dashboards and active spies using `/mouse/stats`.

**Controls (optional if you added the patch):**

* Press `h` → “heatmap mode” (render density blobs instead of lines).

---

## 📡 Why SSE here (not WebSockets/WebTransport)?

* **One-way updates** are all we need (server → dashboards).
* **Built-in reconnection** and simple text framing.
* **Works over HTTP/1.1/2/3** and through most proxies without extra setup.
* If you need **bi-directional** low-latency control, consider **WebSockets** or **WebTransport** instead.

---

## 🔐 Security & privacy

This repo ships wide open for demos. For real use:

* **Consent & disclosure:** make tracking opt-in and anonymized.
* **Auth:** protect `/events/mouse` and `/mouse/stats` (e.g., viewer JWT or shared token).
* **Rate limiting:** cap spy POST frequency; drop oversized batches.
* **Data minimization:** don’t log raw coordinates unless truly needed; consider hashing session IDs.
* **TLS:** always use HTTPS in production.

---

## ⚙️ Performance tips

* **Throttle**: keep spy points ≤ 30 Hz; send only if `dx²+dy² > ε` or >100 ms elapsed.
* **Batching**: aim for 10–20 points/batch to balance overhead vs. latency.
* **Backpressure**: if an SSE client stalls, close the socket; it will reconnect (possibly with a replay).
* **Replay buffer**: store last N frames per room to catch clients up after short disconnects.
* **Edge fanout**: publish frames to a regional broker (Redis/NATS/Cloudflare Pub/Sub) and write SSE at the edge for 10k–100k viewers.

---

## 🧪 Troubleshooting

* **`ERR_MODULE_NOT_FOUND: fastify`**
  Run `npm install` in the project root (same dir as `package.json`).

* **Fastify plugin version mismatch**
  Align majors:

  * Fastify v5 → `npm i fastify@^5 @fastify/cors@latest @fastify/static@latest`
  * Fastify v4 → `npm i fastify@^4 @fastify/cors@^9 @fastify/static@^6`

* **SSE not updating**
  Check proxies: ensure no buffering (`X-Accel-Buffering: no` for Nginx) and idle timeouts > 15s.

* **CORS issues (spy on another origin)**
  This server enables CORS by default. Confirm the browser console for blocked requests.

---

## 🚀 Extensions you can add

* **Room sharding** per site/page (`room=<site>:<path>`).
* **Recording + playback** of sessions (file or object storage).
* **Heatmaps & click maps** with simple aggregation.
* **JWT auth** for viewers, signed short-lived tokens for spies.
* **Analytics**: events/sec, bytes out, slow client drops, replay hits.

---

## 📄 License

MIT — use it, break it, fix it, ship it.
