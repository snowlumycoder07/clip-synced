// functions/api/ws.js
//
// Routes WebSocket upgrade requests to the single ClipRelay Durable Object.
// All connected clients (both your machines) talk to the SAME DO instance,
// which is what lets it broadcast between them directly.

export async function onRequestGet(context) {
  const { request, env } = context;

  // Always use the same fixed name so every client resolves to one instance.
  const id = env.CLIP_RELAY.idFromName("main");
  const stub = env.CLIP_RELAY.get(id);

  // Forward the request (including the Upgrade header and ?key= query param)
  // straight to the Durable Object's fetch handler.
  return stub.fetch(request);
}
