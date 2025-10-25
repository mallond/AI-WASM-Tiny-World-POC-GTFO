# Serverless P2P Chat (Single-File WebRTC) — README

A **single HTML file** that lets two peers chat **directly** via **WebRTC DataChannels** with **manual (copy-paste) signaling**.
✅ No server. ✅ No build. ✅ Just open the file from two separate sessions (preferably via two local servers on different ports).

---

## What’s included

```
index.html   # Single-file SPA (UI + WebRTC; manual copy/paste signaling)
```

---

## How it works (brief)

* **WebRTC DataChannel** carries your chat messages directly between browsers.
* **Manual signaling**: you copy-paste the SDP blobs (offer/answer) between the two peers yourself—no signaling server.
* **ICE (NAT traversal)**:

  * Uses a **public STUN** server (toggleable) to discover candidates.
  * **No TURN** is included (keeps it serverless). If your networks are strict, connections may fail—see notes below.

> For simplicity, the page **waits for ICE gathering to complete** before showing your Local Description (no trickle ICE). That means you copy just one blob each time.

---

## Quick start (two local ports)

You’ll run the same `index.html` on **two different ports** so each tab has its own clean session & origin.

### Option A: Python (no install needed on most systems)

```bash
# Terminal 1
python -m http.server 8080

# Terminal 2
python -m http.server 8081
```

Open:

* Window A → `http://localhost:8080/index.html`
* Window B → `http://localhost:8081/index.html`

### Option B: Node

```bash
# Using npx:
npx http-server -p 8080
npx http-server -p 8081
```

Open the same URLs as above.

> Avoid opening the file as `file:///…` — some browser features behave differently outside a server context.

---

## Connect the two peers (copy-paste flow)

1. **Window A (Offerer)**

   * Click **Create Offer**.
   * Wait ~1–3s for ICE to finish.
   * Click **Copy Local** and send that JSON blob to Window B (paste it any way you like).

2. **Window B (Answerer)**

   * Paste A’s blob into **Remote Description**.
   * Click **Set Remote & Create Answer**.
   * Wait for ICE to finish, then **Copy Local** and send that blob back to Window A.

3. **Window A**

   * Paste B’s blob into **Remote Description**.
   * Click **Set Remote**.

👉 Status will flip to **Connected**, and the message box enables. Type a message and hit **Send** (or press Enter).

---

## Testing tips

* **Different browsers**: Try **Chrome ↔ Firefox** to catch interop quirks.
* **Same network first**: If you can, start on the same Wi-Fi.
* **STUN toggle**:

  * If both peers are on the **same LAN**, trying **with STUN off** can help (uses local candidates).
  * Across different networks, **keep STUN on** (default).
* **Multiple tests**: Use different ports or different browser profiles for truly isolated sessions.

---

## Troubleshooting

* **Never connects / ICE fails**
  Likely a NAT/firewall issue. Because this is serverless, there’s **no TURN relay** fallback. Try:

  * Same network (LAN or same Wi-Fi).
  * Different browser pair.
  * Toggling **Use public STUN**.
* **“Invalid description” when pasting**
  You pasted the wrong blob (offer vs answer), or it was truncated. Hit **Reset**, and follow the 3-step flow again.
* **Clipboard didn’t copy**
  Browser permissions can block programmatic copy. The app selects the text on failure—press **Ctrl/⌘-C** manually.
* **Debugging**
  Open DevTools → Console.
  Deep dive:

  * Chrome: `chrome://webrtc-internals/`
  * Firefox: `about:webrtc`

---

## FAQ

**Why two ports?**
Different ports = different origins/sessions. It avoids cross-tab data clashes and mimics two devices.

**Can I add TURN without a server?**
TURN requires credentials and a reachable relay service. That’s outside “serverless.” For tough networks, you’ll need to introduce a TURN service (e.g., coturn) and switch to a small signaling setup.

**Does it work over HTTPS?**
Yes—serve `index.html` from any static host. Manual copy-paste still works; no backend needed.

---

## Security & privacy

* Messages are **end-to-end** over DTLS once connected.
* The **signaling blobs** you copy-paste contain session metadata (SDP & ICE candidates) but **no chat content**. Handle them like one-time connection tickets.

---

## License

MIT (or your preference).

