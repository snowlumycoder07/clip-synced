export function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    },
  });
}

export function checkAuth(request, env) {
  const key = request.headers.get("x-api-key");
  return env.CLIPBOARD_SECRET && key === env.CLIPBOARD_SECRET;
}

export const HISTORY_LIMIT = 20;
