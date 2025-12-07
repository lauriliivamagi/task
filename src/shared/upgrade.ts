/**
 * Self-update utilities for downloading and installing new versions from GitHub Releases.
 */

import { join } from "@std/path";
import { assert } from "./assert.ts";

const GITHUB_REPO = "lauriliivamagi/task";
const GITHUB_API_URL =
  `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  version: string;
  tagName: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

/**
 * Fetch the latest release information from GitHub.
 */
export async function getLatestRelease(): Promise<ReleaseInfo> {
  const response = await fetch(GITHUB_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "larr-task-updater",
    },
  });

  if (response.status === 403) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    if (remaining === "0") {
      throw new Error(
        "GitHub API rate limit exceeded. Try again later or wait an hour.",
      );
    }
    throw new Error(`GitHub API access forbidden: ${response.statusText}`);
  }

  if (response.status === 404) {
    throw new Error(
      "No releases found. The repository may not have any releases yet.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch release info: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  return {
    version: data.tag_name.replace(/^v/, ""),
    tagName: data.tag_name,
    publishedAt: data.published_at,
    assets: data.assets.map((asset: {
      name: string;
      browser_download_url: string;
      size: number;
    }) => ({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      size: asset.size,
    })),
  };
}

/**
 * Get the binary asset name for the current platform.
 */
export function getPlatformAssetName(): string {
  const arch = Deno.build.arch;
  const os = Deno.build.os;

  if (os !== "linux") {
    throw new Error(
      `Unsupported operating system: ${os}. Only Linux is supported for auto-update.`,
    );
  }

  const target = arch === "x86_64"
    ? "x86_64-unknown-linux-gnu"
    : "aarch64-unknown-linux-gnu";

  return `task-${target}`;
}

/**
 * Find the asset URL for the current platform.
 */
export function findPlatformAsset(
  assets: ReleaseAsset[],
): ReleaseAsset | null {
  const assetName = getPlatformAssetName();
  return assets.find((a) => a.name === assetName) ?? null;
}

/**
 * Download a file from a URL to a destination path.
 * Shows progress indicator to stdout.
 */
export async function downloadFile(
  url: string,
  dest: string,
  options?: { showProgress?: boolean },
): Promise<void> {
  const showProgress = options?.showProgress ?? true;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "larr-task-updater",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download: ${response.status} ${response.statusText}`,
    );
  }

  const contentLength = response.headers.get("Content-Length");
  const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
  const reader = response.body?.getReader();
  assert(reader !== undefined, "Response body is not readable", "update");

  const chunks: Uint8Array[] = [];
  let downloadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    downloadedBytes += value.length;

    if (showProgress && totalBytes) {
      const percent = Math.round((downloadedBytes / totalBytes) * 100);
      const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
      const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
      Deno.stdout.writeSync(
        new TextEncoder().encode(
          `\rDownloading: ${mb}/${totalMb} MB (${percent}%)`,
        ),
      );
    }
  }

  if (showProgress) {
    Deno.stdout.writeSync(new TextEncoder().encode("\n"));
  }

  const fullData = new Uint8Array(downloadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullData.set(chunk, offset);
    offset += chunk.length;
  }

  await Deno.writeFile(dest, fullData);
}

/**
 * Compute SHA256 checksum of a file.
 */
export async function computeChecksum(filePath: string): Promise<string> {
  const data = await Deno.readFile(filePath);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Parse checksums.txt format (sha256sum output format).
 * Format: "<checksum>  <filename>" (two spaces between)
 */
export function parseChecksums(content: string): Map<string, string> {
  const checksums = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: checksum  filename (may have path prefix like "dir/filename")
    const match = trimmed.match(/^([a-f0-9]{64})\s+(.+)$/);
    if (match) {
      const checksum = match[1];
      const filename = match[2].split("/").pop() ?? match[2]; // Get basename
      checksums.set(filename, checksum);
    }
  }
  return checksums;
}

/**
 * Download checksums.txt and verify a file's integrity.
 */
export async function verifyChecksum(
  filePath: string,
  expectedFilename: string,
  checksumAsset: ReleaseAsset,
): Promise<boolean> {
  const response = await fetch(checksumAsset.browser_download_url, {
    headers: { "User-Agent": "larr-task-updater" },
  });

  if (!response.ok) {
    throw new Error(`Failed to download checksums: ${response.status}`);
  }

  const content = await response.text();
  const checksums = parseChecksums(content);
  const expected = checksums.get(expectedFilename);

  if (!expected) {
    throw new Error(
      `Checksum not found for ${expectedFilename} in checksums.txt`,
    );
  }

  const actual = await computeChecksum(filePath);
  return actual === expected;
}

/**
 * Get the path to the current executable.
 */
export function getCurrentExecutablePath(): string {
  return Deno.execPath();
}

/**
 * Check if an error is a cross-device link error (EXDEV).
 * This happens when trying to rename across filesystem boundaries.
 */
function isCrossDeviceError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes("cross-device") ||
      error.message.includes("os error 18");
  }
  return false;
}

/**
 * Replace the current executable with a new one.
 * Creates a backup at {path}.backup
 */
export async function replaceExecutable(
  currentPath: string,
  newBinaryPath: string,
): Promise<void> {
  const backupPath = `${currentPath}.backup`;

  // Set executable permission on new binary
  await Deno.chmod(newBinaryPath, 0o755);

  // Backup current binary
  try {
    await Deno.rename(currentPath, backupPath);
  } catch (error) {
    // If rename fails (e.g., cross-device), try copy
    if (isCrossDeviceError(error)) {
      await Deno.copyFile(currentPath, backupPath);
      await Deno.remove(currentPath);
    } else {
      throw error;
    }
  }

  // Move new binary to target location
  try {
    await Deno.rename(newBinaryPath, currentPath);
  } catch (error) {
    // If rename fails (cross-device), try copy
    if (isCrossDeviceError(error)) {
      await Deno.copyFile(newBinaryPath, currentPath);
      await Deno.remove(newBinaryPath);
    } else {
      // Restore backup on failure
      try {
        await Deno.rename(backupPath, currentPath);
      } catch (restoreError) {
        if (isCrossDeviceError(restoreError)) {
          await Deno.copyFile(backupPath, currentPath);
          await Deno.remove(backupPath);
        } else {
          throw restoreError;
        }
      }
      throw error;
    }
  }

  // Verify new binary works by checking version
  const command = new Deno.Command(currentPath, { args: ["--version"] });
  const { success } = await command.output();

  if (!success) {
    // Rollback
    console.error("New binary failed verification, rolling back...");
    await Deno.remove(currentPath);
    await Deno.rename(backupPath, currentPath);
    throw new Error(
      "New binary failed to execute, rolled back to previous version",
    );
  }

  // Remove backup on success
  try {
    await Deno.remove(backupPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Perform the full upgrade process.
 */
export async function performUpgrade(release: ReleaseInfo): Promise<void> {
  const assetName = getPlatformAssetName();
  const asset = findPlatformAsset(release.assets);

  if (!asset) {
    throw new Error(
      `No binary found for your platform (${assetName}). ` +
        `Available assets: ${release.assets.map((a) => a.name).join(", ")}`,
    );
  }

  const checksumAsset = release.assets.find((a) => a.name === "checksums.txt");
  if (!checksumAsset) {
    throw new Error("checksums.txt not found in release assets");
  }

  // Download to temp file
  const tempDir = Deno.makeTempDirSync();
  const tempBinary = join(tempDir, assetName);

  try {
    console.log(`Downloading ${assetName}...`);
    await downloadFile(asset.browser_download_url, tempBinary);

    console.log("Verifying checksum...");
    const valid = await verifyChecksum(tempBinary, assetName, checksumAsset);
    if (!valid) {
      throw new Error(
        "Checksum verification failed! Download may be corrupted.",
      );
    }
    console.log("Checksum verified.");

    console.log("Installing new version...");
    const currentPath = getCurrentExecutablePath();
    await replaceExecutable(currentPath, tempBinary);

    console.log(`Successfully updated to version ${release.version}`);
  } finally {
    // Cleanup temp directory
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
