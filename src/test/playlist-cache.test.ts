import { describe, it, expect } from "vitest";
import { isStale, CACHE_TTL_MS } from "@/lib/playlist-cache.server";

describe("auto refresh", () => {
  const now = 1_800_000_000_000;
  it("refreshes after 3 hours", () => {
    expect(isStale({ body: "x", fetchedAt: now - CACHE_TTL_MS }, now)).toBe(true);
  });
  it("refreshes when tokens expire within 10 minutes", () => {
    const exp = Math.floor((now + 5 * 60_000) / 1000);
    expect(isStale({ body: `a?__hdnea__=st=1~exp=${exp}~h=z`, fetchedAt: now - 600_000 }, now)).toBe(true);
  });
  it("keeps cache when tokens are still valid", () => {
    const exp = Math.floor((now + 60 * 60_000) / 1000);
    expect(isStale({ body: `a?__hdnea__=st=1~exp=${exp}~h=z`, fetchedAt: now - 600_000 }, now)).toBe(false);
  });
});
