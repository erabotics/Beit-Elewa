// Supabase Edge Function: POST /functions/v1/place-order
// Stateless: no memory between requests, so any number of instances can run.
// Database access goes through Supabase's pooled API, not raw connections.
//
// Request:  headers  Idempotency-Key: <uuid generated once per checkout attempt>
//           body     {"customer": {"fulfillment":"delivery"|"pickup", ...}, "items": [{"id":"kebda","qty":2}]}
// Secrets:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set automatically),
//           ALLOWED_ORIGINS = "https://your-domain.com,https://beit3lewa.lovable.app"

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_000;

// Error codes raised by place_order() -> HTTP status + message shown to the customer.
const ERRORS: Record<string, [number, string]> = {
  INVALID_NAME:           [422, "اكتب اسمك"],
  INVALID_PHONE:          [422, "اكتب رقم موبايل مصري من ١١ رقم يبدأ بـ 01"],
  INVALID_FULFILLMENT:    [422, "اختار توصيل أو استلام من الفرع"],
  INVALID_AREA:           [422, "المنطقة دي مش ضمن مناطق التوصيل، ممكن تستلم من الفرع"],
  INVALID_ADDRESS:        [422, "اكتب العنوان بالتفصيل"],
  INVALID_DETAILS:        [422, "الملاحظات أطول من اللازم"],
  INVALID_ITEMS:          [422, "في مشكلة في السلة، راجعها وجرب تاني"],
  UNKNOWN_ITEM:           [409, "صنف في السلة مبقاش موجود في المنيو"],
  ITEM_UNAVAILABLE:       [409, "صنف في السلة مش متاح دلوقتي"],
  OUT_OF_STOCK:           [409, "الكمية المطلوبة من صنف خلصت"],
  TOO_MANY_ORDERS:        [429, "عملت طلبات كتير في وقت قصير، استنى شوية أو كلمنا"],
  IDEMPOTENCY_KEY_REUSED: [409, "الطلب اتغير، ابعته تاني"],
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "content-type, idempotency-key";
  }
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "METHOD_NOT_ALLOWED" });
  if (!ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: "FORBIDDEN_ORIGIN" });
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) {
    return reply(415, { error: "UNSUPPORTED_MEDIA_TYPE" });
  }

  const key = req.headers.get("idempotency-key") ?? "";
  if (!UUID_RE.test(key)) return reply(400, { error: "MISSING_IDEMPOTENCY_KEY" });

  // Per-IP rate limit (IP is hashed so raw addresses are never stored).
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: allowed, error: rlError } = await supabase.rpc("hit_rate_limit", {
    p_bucket: "checkout:" + (await sha256(ip)),
    p_max: 10,
    p_window_seconds: 600,
  });
  if (rlError) {
    console.error("rate limit check failed", rlError);
    return reply(503, { error: "TRY_AGAIN", message: "حصلت مشكلة، جرب تاني كمان شوية" });
  }
  if (!allowed) return reply(429, { error: "RATE_LIMITED", message: ERRORS.TOO_MANY_ORDERS[1] });

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(413, { error: "PAYLOAD_TOO_LARGE" });

  let body: { customer?: unknown; items?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: "INVALID_JSON" });
  }
  if (typeof body !== "object" || body === null || typeof body.customer !== "object" || !Array.isArray(body.items)) {
    return reply(422, { error: "INVALID_ITEMS", message: ERRORS.INVALID_ITEMS[1] });
  }

  // All real validation, pricing, locking and writing happens in one DB transaction.
  const { data, error } = await supabase.rpc("place_order", {
    p_idempotency_key: key,
    p_customer: body.customer,
    p_items: body.items,
  });

  if (error) {
    const [code, itemId] = (error.message ?? "").split(":");
    const known = ERRORS[code];
    if (!known) {
      console.error("place_order failed", error); // details stay in server logs only
      return reply(500, { error: "SERVER_ERROR", message: "حصلت مشكلة، جرب تاني أو كلمنا على 01034745251" });
    }
    return reply(known[0], { error: code, message: known[1], item: itemId ?? null });
  }

  return reply(data.replayed ? 200 : 201, data);
});
