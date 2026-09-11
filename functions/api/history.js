import { json, checkAuth, HISTORY_KEY } from "../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const raw = await env.CLIPBOARD_KV.get(HISTORY_KEY);
  return json({ history: raw ? JSON.parse(raw) : [] });
}

export async function onRequestOptions() {
  return json({}, 204);
}
