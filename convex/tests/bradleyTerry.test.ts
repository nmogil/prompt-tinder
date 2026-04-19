import { describe, expect, it } from "vitest";
import {
  computeBradleyTerry,
  hasClearLeader,
  type BTMatchup,
} from "../lib/bradleyTerry";

describe("computeBradleyTerry", () => {
  it("returns empty for no players", () => {
    expect(computeBradleyTerry([], [])).toEqual([]);
  });

  it("gives equal strength when there is no data", () => {
    const standings = computeBradleyTerry(["a", "b", "c"], []);
    expect(standings).toHaveLength(3);
    const [a, b, c] = standings;
    expect(a!.strength).toBeCloseTo(1, 5);
    expect(b!.strength).toBeCloseTo(1, 5);
    expect(c!.strength).toBeCloseTo(1, 5);
  });

  it("ranks an undefeated player above a winless one", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "a", loserId: "b" },
      { winnerId: "a", loserId: "b" },
    ];
    const standings = computeBradleyTerry(["a", "b"], matchups);
    expect(standings[0]!.playerId).toBe("a");
    expect(standings[1]!.playerId).toBe("b");
    expect(standings[0]!.strength).toBeGreaterThan(standings[1]!.strength);
    expect(standings[0]!.wins).toBe(3);
    expect(standings[1]!.losses).toBe(3);
  });

  it("rewards beating strong opponents more than weak ones", () => {
    // a beats b (weak), c beats d (strong player who beat others)
    const matchups: BTMatchup[] = [
      { winnerId: "b", loserId: "e" },
      { winnerId: "b", loserId: "e" },
      { winnerId: "d", loserId: "e" },
      { winnerId: "d", loserId: "b" },
      { winnerId: "d", loserId: "b" },
      { winnerId: "a", loserId: "b" }, // a beats weaker
      { winnerId: "c", loserId: "d" }, // c beats stronger
    ];
    const standings = computeBradleyTerry(["a", "b", "c", "d", "e"], matchups);
    const byId = Object.fromEntries(standings.map((s) => [s.playerId, s]));
    // c beat the stronger opponent (d who beat b and e), so c should rank
    // strictly above a who only beat weak b.
    expect(byId.c!.strength).toBeGreaterThan(byId.a!.strength);
  });

  it("handles ties symmetrically", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b", tie: true },
      { winnerId: "a", loserId: "b", tie: true },
    ];
    const standings = computeBradleyTerry(["a", "b"], matchups);
    const [a, b] = standings;
    // With ties only, regularization keeps both near 1.
    expect(a!.strength).toBeCloseTo(b!.strength, 3);
    expect(a!.ties).toBe(2);
    expect(b!.ties).toBe(2);
  });

  it("normalizes so the geometric mean is 1", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "c", loserId: "d" },
    ];
    const standings = computeBradleyTerry(["a", "b", "c", "d"], matchups);
    const logSum = standings.reduce((acc, s) => acc + Math.log(s.strength), 0);
    expect(logSum / standings.length).toBeCloseTo(0, 4);
  });

  it("ignores matchups referencing unknown players", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "ghost", loserId: "a" },
    ];
    const standings = computeBradleyTerry(["a", "b"], matchups);
    expect(standings[0]!.playerId).toBe("a");
    expect(standings[0]!.wins).toBe(1);
    expect(standings[0]!.losses).toBe(0);
  });

  it("exposes win/loss/tie counts per player", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "c", loserId: "a" },
      { winnerId: "b", loserId: "c", tie: true },
    ];
    const standings = computeBradleyTerry(["a", "b", "c"], matchups);
    const byId = Object.fromEntries(standings.map((s) => [s.playerId, s]));
    expect(byId.a!.wins).toBe(1);
    expect(byId.a!.losses).toBe(1);
    expect(byId.a!.ties).toBe(0);
    expect(byId.b!.wins).toBe(0);
    expect(byId.b!.losses).toBe(1);
    expect(byId.b!.ties).toBe(1);
    expect(byId.c!.wins).toBe(1);
    expect(byId.c!.losses).toBe(0);
    expect(byId.c!.ties).toBe(1);
  });
});

describe("hasClearLeader", () => {
  it("returns false for < 2 players", () => {
    const standings = computeBradleyTerry(["a"], []);
    expect(hasClearLeader(standings)).toBe(false);
  });

  it("returns false when nobody has played enough battles", () => {
    const standings = computeBradleyTerry(
      ["a", "b"],
      [{ winnerId: "a", loserId: "b" }],
    );
    expect(hasClearLeader(standings, { minBattles: 2 })).toBe(false);
  });

  it("returns true when the leader is at least threshold× the runner-up", () => {
    const matchups: BTMatchup[] = [
      { winnerId: "a", loserId: "b" },
      { winnerId: "a", loserId: "b" },
      { winnerId: "a", loserId: "c" },
      { winnerId: "a", loserId: "c" },
    ];
    const standings = computeBradleyTerry(["a", "b", "c"], matchups);
    expect(hasClearLeader(standings, { threshold: 1.5, minBattles: 1 })).toBe(
      true,
    );
  });
});
