import { json, checkAuth, LATEST_KEY } from "../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!checkAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const raw = await env.CLIPBOARD_KV.get(LATEST_KEY);
  return json(raw ? JSON.parse(raw) : { text: "", updatedAt: null });
}

export async function onRequestOptions() {
  return json({}, 204);
}
