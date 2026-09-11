import { json, checkAuth, HISTORY_LIMIT } from "../_utils.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!checkAuth(request, env)) return json({ error: "Unauthorized" }, 401);

  const { results } = await env.DB.prepare(
    "SELECT text, updated_at FROM clips ORDER BY id DESC LIMIT ?"
  ).bind(HISTORY_LIMIT).all();

  const history = (results || []).map((r) => ({ text: r.text, updatedAt: r.updated_at }));
  return json({ history });
}

export async function onRequestOptions() {
  return json({}, 204);
}
