import denoConfig from "../../deno.json" with { type: "json" };

export const APP_VERSION: string = denoConfig.version;

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a semver string (e.g., "1.2.3" or "v1.2.3") into components.
 * Returns null if the string is not a valid semver.
 */
export function parseVersion(version: string): SemVer | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semver versions.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) {
    throw new Error(`Invalid version format: ${!parsedA ? a : b}`);
  }

  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }
  return 0;
}

/**
 * Check if an update is available (latest > current).
 */
export function isUpdateAvailable(current: string, latest: string): boolean {
  return compareVersions(latest, current) === 1;
}
