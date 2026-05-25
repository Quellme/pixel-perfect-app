import { createHmac, timingSafeEqual } from "crypto";

export type StatePayload = {
  userId: string;
  origin: string;
  category?: "work" | "personal";
};

export function signState(payload: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  try {
    const [b64, sig] = state.split(".");
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, "base64url").toString("utf8");
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    )
      return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
