import { json, checkAuth } from "../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const row = await env.DB.prepare(
    "SELECT text, updated_at FROM clips ORDER BY id DESC LIMIT 1"
  ).first();

  if (!row) return json({ text: "", updatedAt: null });
  return json({ text: row.text, updatedAt: row.updated_at });
}

export async function onRequestOptions() {
  return json({}, 204);
}
