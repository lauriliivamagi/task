/**
 * Filesystem Abstraction
 *
 * Provides a unified interface for filesystem operations that can be
 * implemented by different backends:
 * - DenoFS: Uses Deno's native file APIs (production)
 * - AgentFS: Uses AgentFS SDK for isolated testing
 * - MemoryFS: Simple in-memory implementation for unit tests
 *
 * This abstraction enables testing code that interacts with the filesystem
 * without polluting the real filesystem.
 */

/**
 * Interface for filesystem operations used by the application.
 */
export interface FileSystem {
  /**
   * Read a file as text.
   * @throws If file doesn't exist or can't be read
   */
  readTextFile(path: string): Promise<string>;

  /**
   * Write text content to a file.
   * Creates parent directories if they don't exist.
   */
  writeTextFile(path: string, content: string): Promise<void>;

  /**
   * Check if a file or directory exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Ensure a directory exists, creating it if necessary.
   */
  ensureDir(path: string): Promise<void>;
}

/**
 * Production filesystem using Deno APIs.
 */
export class DenoFS implements FileSystem {
  async readTextFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await Deno.writeTextFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(path: string): Promise<void> {
    const { ensureDir } = await import("@std/fs");
    await ensureDir(path);
  }
}

/**
 * Directory entry for readDir results.
 */
export interface DirEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

/**
 * Extended filesystem interface with directory operations.
 */
export interface ExtendedFileSystem extends FileSystem {
  /**
   * Read directory contents.
   */
  readDir(path: string): Promise<DirEntry[]>;

  /**
   * Rename/move a file or directory.
   */
  rename(oldPath: string, newPath: string): Promise<void>;

  /**
   * Remove a file or directory.
   */
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Check if path is a directory.
   */
  isDirectory(path: string): Promise<boolean>;
}

/**
 * In-memory filesystem for simple unit tests.
 * Does not require any external dependencies.
 * Implements ExtendedFileSystem for full test support.
 */
export class MemoryFS implements ExtendedFileSystem {
  private files: Map<string, string> = new Map();
  private dirs: Set<string> = new Set();

  constructor() {
    // Root always exists
    this.dirs.add("/");
  }

  readTextFile(path: string): Promise<string> {
    const content = this.files.get(this.normalizePath(path));
    if (content === undefined) {
      return Promise.reject(
        new Deno.errors.NotFound(`File not found: ${path}`),
      );
    }
    return Promise.resolve(content);
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    // Ensure parent directory exists
    const parentDir = this.getParentDir(normalizedPath);
    if (parentDir) {
      await this.ensureDir(parentDir);
    }
    this.files.set(normalizedPath, content);
  }

  exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return Promise.resolve(
      this.files.has(normalizedPath) || this.dirs.has(normalizedPath),
    );
  }

  ensureDir(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    // Create all parent directories
    const parts = normalizedPath.split("/").filter(Boolean);
    let currentPath = "";
    for (const part of parts) {
      currentPath += "/" + part;
      this.dirs.add(currentPath);
    }
    return Promise.resolve();
  }

  readDir(path: string): Promise<DirEntry[]> {
    const normalizedPath = this.normalizePath(path);

    if (!this.dirs.has(normalizedPath)) {
      return Promise.reject(
        new Deno.errors.NotFound(`Directory not found: ${path}`),
      );
    }

    const entries: DirEntry[] = [];
    const prefix = normalizedPath === "/" ? "/" : normalizedPath + "/";

    // Find all files in this directory (direct children only)
    for (const filePath of this.files.keys()) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.slice(prefix.length);
        // Only include direct children (no "/" in relative path)
        if (!relativePath.includes("/")) {
          entries.push({
            name: relativePath,
            isFile: true,
            isDirectory: false,
          });
        }
      }
    }

    // Find all subdirectories (direct children only)
    for (const dirPath of this.dirs) {
      if (dirPath.startsWith(prefix) && dirPath !== normalizedPath) {
        const relativePath = dirPath.slice(prefix.length);
        // Only include direct children
        if (!relativePath.includes("/")) {
          entries.push({
            name: relativePath,
            isFile: false,
            isDirectory: true,
          });
        }
      }
    }

    return Promise.resolve(entries);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);

    // Check if it's a file
    if (this.files.has(normalizedOld)) {
      const content = this.files.get(normalizedOld);
      if (content === undefined) {
        throw new Error(`File content not found: ${normalizedOld}`);
      }
      this.files.delete(normalizedOld);
      // Ensure parent directory of new path exists
      const parentDir = this.getParentDir(normalizedNew);
      if (parentDir) {
        await this.ensureDir(parentDir);
      }
      this.files.set(normalizedNew, content);
      return;
    }

    // Check if it's a directory
    if (this.dirs.has(normalizedOld)) {
      // Move directory and all contents
      const oldPrefix = normalizedOld + "/";

      // Move files
      const filesToMove: [string, string][] = [];
      for (const [filePath, _content] of this.files) {
        if (filePath.startsWith(oldPrefix) || filePath === normalizedOld) {
          const newFilePath = filePath.replace(normalizedOld, normalizedNew);
          filesToMove.push([filePath, newFilePath]);
        }
      }
      for (const [oldFilePath, newFilePath] of filesToMove) {
        const content = this.files.get(oldFilePath);
        this.files.delete(oldFilePath);
        if (content !== undefined) {
          this.files.set(newFilePath, content);
        }
      }

      // Move directories
      const dirsToMove: [string, string][] = [];
      for (const dirPath of this.dirs) {
        if (dirPath.startsWith(oldPrefix) || dirPath === normalizedOld) {
          const newDirPath = dirPath.replace(normalizedOld, normalizedNew);
          dirsToMove.push([dirPath, newDirPath]);
        }
      }
      for (const [oldDirPath, newDirPath] of dirsToMove) {
        this.dirs.delete(oldDirPath);
        this.dirs.add(newDirPath);
      }
      return;
    }

    throw new Deno.errors.NotFound(`Path not found: ${oldPath}`);
  }

  remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    // Check if it's a file
    if (this.files.has(normalizedPath)) {
      this.files.delete(normalizedPath);
      return Promise.resolve();
    }

    // Check if it's a directory
    if (this.dirs.has(normalizedPath)) {
      const prefix = normalizedPath + "/";

      // Check if directory has contents
      const hasFiles = [...this.files.keys()].some((f) => f.startsWith(prefix));
      const hasSubdirs = [...this.dirs].some(
        (d) => d.startsWith(prefix) && d !== normalizedPath,
      );

      if ((hasFiles || hasSubdirs) && !options?.recursive) {
        return Promise.reject(new Error(`Directory not empty: ${path}`));
      }

      // Remove all files in directory
      for (const filePath of [...this.files.keys()]) {
        if (filePath.startsWith(prefix)) {
          this.files.delete(filePath);
        }
      }

      // Remove all subdirectories
      for (const dirPath of [...this.dirs]) {
        if (dirPath.startsWith(prefix) || dirPath === normalizedPath) {
          this.dirs.delete(dirPath);
        }
      }
      return Promise.resolve();
    }

    return Promise.reject(new Deno.errors.NotFound(`Path not found: ${path}`));
  }

  isDirectory(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return Promise.resolve(this.dirs.has(normalizedPath));
  }

  /**
   * Clear all files and directories (except root).
   * Useful between tests.
   */
  clear(): void {
    this.files.clear();
    this.dirs.clear();
    this.dirs.add("/");
  }

  /**
   * Get all files for inspection in tests.
   */
  getFiles(): Map<string, string> {
    return new Map(this.files);
  }

  /**
   * Get all directories for inspection in tests.
   */
  getDirs(): Set<string> {
    return new Set(this.dirs);
  }

  private normalizePath(path: string): string {
    // Simple normalization - remove trailing slashes, handle relative paths
    let normalized = path.replace(/\/+/g, "/").replace(/\/$/, "");
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }
    return normalized || "/";
  }

  private getParentDir(path: string): string | null {
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash <= 0) return null;
    return path.substring(0, lastSlash);
  }
}

/**
 * AgentFS-backed filesystem for isolated integration tests.
 * Stores all file operations in an in-memory SQLite database.
 */
export class AgentFileSystem implements FileSystem {
  private agentFS:
    | Awaited<ReturnType<typeof import("agentfs-sdk").AgentFS.open>>
    | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Lazy initialization
  }

  private async init(): Promise<void> {
    if (this.agentFS) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      const { AgentFS } = await import("agentfs-sdk");
      this.agentFS = await AgentFS.open({ path: ":memory:" });
    })();

    await this.initPromise;
  }

  async readTextFile(path: string): Promise<string> {
    await this.init();
    if (!this.agentFS) {
      throw new Error("AgentFS not initialized");
    }
    try {
      const content = await this.agentFS.fs.readFile(path, "utf8");
      return content as string;
    } catch {
      throw new Deno.errors.NotFound(`File not found: ${path}`);
    }
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    await this.init();
    if (!this.agentFS) {
      throw new Error("AgentFS not initialized");
    }
    await this.agentFS.fs.writeFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    await this.init();
    if (!this.agentFS) {
      throw new Error("AgentFS not initialized");
    }
    try {
      await this.agentFS.fs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(_path: string): Promise<void> {
    // AgentFS auto-creates parent directories on writeFile
    // For explicit directory creation, we can write a marker file
    await this.init();
    // No-op for AgentFS as directories are created implicitly
  }

  /**
   * Close the AgentFS connection.
   * Call this at the end of tests.
   */
  async close(): Promise<void> {
    if (this.agentFS) {
      await this.agentFS.close();
      this.agentFS = null;
      this.initPromise = null;
    }
  }
}

// Global filesystem instance - can be swapped for testing
let globalFS: FileSystem = new DenoFS();

/**
 * Get the current global filesystem.
 */
export function getFS(): FileSystem {
  return globalFS;
}

/**
 * Set the global filesystem.
 * Use this in tests to inject a mock filesystem.
 */
export function setFS(fs: FileSystem): void {
  globalFS = fs;
}

/**
 * Reset the global filesystem to the default (DenoFS).
 */
export function resetFS(): void {
  globalFS = new DenoFS();
}
