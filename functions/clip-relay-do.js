// functions/clip-relay-do.js
//
// Durable Object: ClipRelay
// A single always-on instance that holds every connected WebSocket and
// broadcasts a new clip to all of them the instant one is uploaded.
// True push - no polling, no setInterval, no D1 round-trips per second.
//
// State is kept in the DO's own in-memory fields (latestText/latestUpdatedAt)
// plus persisted to its SQLite storage so it survives a restart/eviction.
// Your existing D1 "clips" table is left untouched - /api/upload, /api/latest,
// /api/history keep working exactly as before; this DO is an independent
// live-push layer, and also mirrors uploads into D1 so history stays complete.

export class ClipRelay {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
    this.latestText = null;
    this.latestUpdatedAt = null;

    // Restore last-known clip from durable storage on cold start.
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get("latest");
      if (stored) {
        this.latestText = stored.text;
        this.latestUpdatedAt = stored.updatedAt;
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const key = url.searchParams.get("key");
      if (!this.env.CLIPBOARD_SECRET || key !== this.env.CLIPBOARD_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.attachSocket(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  attachSocket(ws) {
    this.sockets.add(ws);

    // Push current state immediately on connect.
    if (this.latestText !== null) {
      this.safeSend(ws, {
        type: "clip",
        text: this.latestText,
        updatedAt: this.latestUpdatedAt,
      });
    } else {
      this.safeSend(ws, { type: "welcome" });
    }

    ws.addEventListener("message", async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        this.safeSend(ws, { type: "error", error: "invalid_json" });
        return;
      }

      if (msg.type === "ping") {
        this.safeSend(ws, { type: "pong" });
        return;
      }

      if (msg.type === "upload") {
        const text = msg.text;
        if (typeof text !== "string" || text.length === 0) {
          this.safeSend(ws, { type: "error", error: "no_text" });
          return;
        }

        const updatedAt = new Date().toISOString();
        this.latestText = text;
        this.latestUpdatedAt = updatedAt;

        // Persist so a DO restart doesn't lose the latest clip.
        await this.state.storage.put("latest", { text, updatedAt });

        // Mirror into the existing D1 "clips" table so /api/history and
        // /api/latest (the old HTTP endpoints) stay in sync too.
        if (this.env.DB) {
          try {
            await this.env.DB.prepare(
              "INSERT INTO clips (text, updated_at) VALUES (?, ?)"
            )
              .bind(text, updatedAt)
              .run();
          } catch (err) {
            // Non-fatal: live push still succeeds even if D1 mirror fails.
          }
        }

        this.safeSend(ws, { type: "ack", updatedAt });

        // Broadcast to every OTHER connected socket.
        for (const other of this.sockets) {
          if (other !== ws) {
            this.safeSend(other, { type: "clip", text, updatedAt });
          }
        }
        return;
      }

      this.safeSend(ws, { type: "error", error: "unknown_type: " + msg.type });
    });

    ws.addEventListener("close", () => this.sockets.delete(ws));
    ws.addEventListener("error", () => this.sockets.delete(ws));
  }

  safeSend(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      this.sockets.delete(ws);
    }
  }
}
