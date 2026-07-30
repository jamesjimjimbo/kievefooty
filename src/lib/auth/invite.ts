import { createHash, timingSafeEqual } from "node:crypto";

const LEAGUE_INVITE_CODE_HASH =
  "5e51f7bab4b31cbc664d7a55c6b88dc9524cd5a4b8b109403baac7642d912506";

export function isValidLeagueInviteCode(code: string) {
  const suppliedHash = createHash("sha256").update(code.trim().toLowerCase()).digest();
  const expectedHash = Buffer.from(LEAGUE_INVITE_CODE_HASH, "hex");

  return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
}
