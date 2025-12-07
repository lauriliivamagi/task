# Local-First Design

Why Task stores your data locally and what that means for you.

## Your Data, Your Machine

Task uses SQLite stored in `~/.task-cli/databases/`. There's no cloud service,
no account, no server to sign up for. Your tasks exist only on your computer.

This is a deliberate choice, not a limitation.

## Why Local-First?

### Privacy

Your tasks are private by default. No company can read them, sell them, or train
AI models on them. No data breach can expose your personal or work tasks to the
internet.

### Reliability

Task CLI works offline. No internet? No problem. The application doesn't depend
on a server being up or reachable.

### Speed

Local SQLite is fast—milliseconds for most operations. There's no network
latency, no waiting for cloud sync.

### Ownership

You can back up your data however you want. Copy the files, use Git, sync with
rsync. The SQLite database is a standard format that any tool can read.

### Longevity

Cloud services shut down. Companies go bankrupt. When that happens, users lose
their data. With local storage, your data survives as long as you have the
files.

## Trade-offs

### Multi-Device Sync

Local-first means you need to handle sync yourself. Task CLI provides Git sync
for this, but it's not automatic like cloud services. You have to set it up and
manage conflicts.

### Collaboration

There's no built-in sharing. You can share via Git, but there's no real-time
collaboration like some cloud task managers offer.

### Backup Responsibility

Your data is your responsibility. If your disk fails and you don't have backups,
your tasks are gone. With cloud services, backup is someone else's problem.

## The Git Sync Middle Ground

For users who want sync without giving up local ownership, Task CLI offers Git
sync:

```bash
task sync init git@github.com:username/task-sync.git
task sync push
task sync pull
```

This gives you:

- Multi-device access via any Git hosting
- Version history of all changes
- Merge conflict resolution
- Still fully local when offline

The sync is opt-in and uses standard Git, so you control where the data goes.

## SQLite as the Foundation

We chose SQLite because it:

- Requires zero setup
- Is extremely reliable (used in aircraft, browsers, phones)
- Supports complex queries (joins, aggregates)
- Has excellent tooling (any SQL client can open it)
- Handles concurrent reads well
- Stores everything in one file

For vector search (semantic search), we use SQLite's sqlite-vec extension,
keeping embeddings alongside task data.

## Alternative Approaches We Considered

**Cloud-first with local cache:** This is how most task apps work. We rejected
it because it makes the cloud the source of truth, and offline mode is always an
afterthought.

**Peer-to-peer sync (CRDTs):** Promising for real-time collaboration without a
central server, but adds significant complexity. Git sync is simpler and good
enough for most users.

**Flat files (JSON, Markdown):** Easy to edit by hand, but complex queries
become slow. SQLite gives us the query power we need for semantic search,
filtering, and reports.

## When Local-First Isn't Right

If you need:

- Real-time collaboration with teammates
- Automatic sync to all devices with zero setup
- Web access from any browser without installation

Then a cloud task manager might be a better fit. Task CLI is designed for
individual users or small teams who value data ownership over convenience.
