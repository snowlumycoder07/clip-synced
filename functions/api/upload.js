import { json, checkAuth, LATEST_KEY, HISTORY_KEY, HISTORY_LIMIT } from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const contentType = request.headers.get("content-type") || "";
  let text;

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    text = body.text;
  } else {
    text = await request.text();
  }

  if (typeof text !== "string" || text.length === 0) {
    return json({ error: "No text provided" }, 400);
  }

  const entry = { text, updatedAt: new Date().toISOString() };
  await env.CLIPBOARD_KV.put(LATEST_KEY, JSON.stringify(entry));

  const historyRaw = await env.CLIPBOARD_KV.get(HISTORY_KEY);
  const history = historyRaw ? JSON.parse(historyRaw) : [];
  history.unshift(entry);
  await env.CLIPBOARD_KV.put(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));

  return json({ ok: true, entry });
}

export async function onRequestOptions() {
  return json({}, 204);
}
