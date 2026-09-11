import { json, checkAuth } from "../_utils.js";

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

  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    "INSERT INTO clips (text, updated_at) VALUES (?, ?)"
  )
    .bind(text, updatedAt)
    .run();

  return json({ ok: true, entry: { text, updatedAt } });
}

export async function onRequestOptions() {
  return json({}, 204);
}
