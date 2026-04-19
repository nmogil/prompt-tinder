/**
 * Bradley-Terry standings for Phase 2 matchups.
 *
 * Wins alone conflate "beat a strong opponent" with "beat a weak opponent."
 * Bradley-Terry iteratively solves for a per-player strength parameter that
 * explains the observed win/loss pattern — so beating strong opponents lifts
 * your score more than beating weak ones.
 *
 * Pure function: no Convex context, no I/O, no side effects.
 */

export type BTMatchup = {
  winnerId: string;
  loserId: string;
  tie?: boolean;
};

export type BTStanding = {
  playerId: string;
  /** Ratio-scale strength (geometric mean normalized to 1.0). */
  strength: number;
  /** Log2(strength) — easier to compare as "+1 = twice as strong." */
  logStrength: number;
  wins: number;
  losses: number;
  ties: number;
  battles: number;
};

type Options = {
  maxIterations?: number;
  /** Stop when max parameter change drops below this. */
  tolerance?: number;
  /** Pseudo-count added to every wins/losses pair for regularization. */
  smoothing?: number;
};

/**
 * Run the Minorization-Maximization (MM) algorithm to estimate strengths.
 * Ties count as 0.5 wins for each side (standard simplification — a proper
 * Davidson extension exists but is overkill at our scale).
 *
 * Returns standings sorted strongest → weakest.
 */
export function computeBradleyTerry(
  playerIds: string[],
  matchups: BTMatchup[],
  options: Options = {},
): BTStanding[] {
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 1e-6;
  const smoothing = options.smoothing ?? 0.5;

  const n = playerIds.length;
  if (n === 0) return [];

  const indexOf = new Map<string, number>();
  playerIds.forEach((id, i) => indexOf.set(id, i));

  // wins[i][j] = number of times i beat j, ties contribute 0.5 to both.
  const wins: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const winCounts = new Array(n).fill(0);
  const lossCounts = new Array(n).fill(0);
  const tieCounts = new Array(n).fill(0);

  for (const m of matchups) {
    const wi = indexOf.get(m.winnerId);
    const li = indexOf.get(m.loserId);
    if (wi === undefined || li === undefined) continue;
    if (wi === li) continue;
    if (m.tie) {
      wins[wi]![li]! += 0.5;
      wins[li]![wi]! += 0.5;
      tieCounts[wi]!++;
      tieCounts[li]!++;
    } else {
      wins[wi]![li]! += 1;
      winCounts[wi]!++;
      lossCounts[li]!++;
    }
  }

  // Apply smoothing so isolated or undefeated players don't blow up the scale.
  if (smoothing > 0) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        wins[i]![j]! += smoothing;
      }
    }
  }

  // Total wins per player (row sum).
  const totalWins = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      totalWins[i]! += wins[i]![j]!;
    }
  }

  let strength = new Array(n).fill(1);

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Array(n).fill(0);
    let maxDelta = 0;

    for (let i = 0; i < n; i++) {
      // denominator = sum_{j != i} (wins[i][j] + wins[j][i]) / (s[i] + s[j])
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const nij = wins[i]![j]! + wins[j]![i]!;
        if (nij === 0) continue;
        denom += nij / (strength[i]! + strength[j]!);
      }
      next[i] = denom === 0 ? strength[i] : totalWins[i]! / denom;
      const delta = Math.abs(next[i]! - strength[i]!);
      if (delta > maxDelta) maxDelta = delta;
    }

    // Normalize so geometric mean = 1 (prevents numerical drift).
    let logSum = 0;
    for (let i = 0; i < n; i++) logSum += Math.log(next[i]!);
    const geo = Math.exp(logSum / n);
    for (let i = 0; i < n; i++) next[i] = next[i]! / geo;

    strength = next;
    if (maxDelta < tolerance) break;
  }

  return playerIds
    .map((id, i) => ({
      playerId: id,
      strength: strength[i]!,
      logStrength: Math.log2(strength[i]!),
      wins: winCounts[i]!,
      losses: lossCounts[i]!,
      ties: tieCounts[i]!,
      battles: winCounts[i]! + lossCounts[i]! + tieCounts[i]!,
    }))
    .sort((a, b) => {
      if (b.strength !== a.strength) return b.strength - a.strength;
      return a.playerId.localeCompare(b.playerId);
    });
}

/**
 * Early-stop check: does one player have a clear lead sufficient to end the
 * session before running every suggested round?
 *
 * "Clear" = top player's strength is at least `threshold` times the second
 * player's strength, AND every player has at least `minBattles` battles so
 * the estimate isn't driven by tiny sample sizes.
 */
export function hasClearLeader(
  standings: BTStanding[],
  options: { threshold?: number; minBattles?: number } = {},
): boolean {
  const threshold = options.threshold ?? 2;
  const minBattles = options.minBattles ?? 2;
  if (standings.length < 2) return false;
  const top = standings[0]!;
  const second = standings[1]!;
  if (top.battles < minBattles) return false;
  if (second.strength === 0) return true;
  return top.strength / second.strength >= threshold;
}
