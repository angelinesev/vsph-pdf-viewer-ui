import { getServiceClient } from "./supabase.ts";

const PBKDF2_ITERATIONS = 100000;

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt.buffer)}$${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits) === expected;
}

export async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { error: { status: 401, body: { error: "Missing admin authorization" } } };
  }
  const jwt = auth.slice(7);
  const supabase = getServiceClient();
  const { data: userData, error } = await supabase.auth.getUser(jwt);
  if (error || !userData?.user) {
    return { error: { status: 401, body: { error: "Invalid admin session" } } };
  }
  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("user_id, email")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (adminError) {
    return { error: { status: 500, body: { error: adminError.message } } };
  }
  if (!admin) {
    return { error: { status: 403, body: { error: "Not a platform admin" } } };
  }
  return { user: userData.user, admin };
}

export async function requireDeveloper(req: Request) {
  const token =
    req.headers.get("x-developer-token") ||
    (req.headers.get("Authorization")?.startsWith("Bearer ")
      ? req.headers.get("Authorization")!.slice(7)
      : null);
  if (!token) {
    return { error: { status: 401, body: { error: "Missing developer session" } } };
  }
  const supabase = getServiceClient();
  const { data: session, error } = await supabase
    .from("developer_sessions")
    .select("token, org_id, developer_code_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    return { error: { status: 500, body: { error: error.message } } };
  }
  if (!session) {
    return { error: { status: 401, body: { error: "Invalid developer session" } } };
  }
  if (new Date(session.expires_at) < new Date()) {
    return { error: { status: 401, body: { error: "Developer session expired" } } };
  }
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, status, plan_id")
    .eq("id", session.org_id)
    .maybeSingle();
  if (orgError) {
    return { error: { status: 500, body: { error: orgError.message } } };
  }
  if (!org || org.status !== "active") {
    return { error: { status: 403, body: { error: "Organization inactive" } } };
  }
  return { session, org, token };
}
