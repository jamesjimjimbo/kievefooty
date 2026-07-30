import { describe, expect, it } from "vitest";
import { isValidLeagueInviteCode } from "./invite";

describe("league invite code", () => {
  it("accepts the league code without being case-sensitive", () => {
    expect(isValidLeagueInviteCode("pasquaney")).toBe(true);
    expect(isValidLeagueInviteCode(" Pasquaney ")).toBe(true);
  });

  it("rejects missing or incorrect codes", () => {
    expect(isValidLeagueInviteCode("")).toBe(false);
    expect(isValidLeagueInviteCode("pasquany")).toBe(false);
  });
});
