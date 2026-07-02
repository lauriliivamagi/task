---
type: explanation
domain: complicated
audience: practitioner
stability: structural
authority:
  provenance: institutional
  verifiability: auditable
  evidence: moderate
  currency: undated
epistemic-layer: theory
---

# How Semantic Search Works

Understanding the technology behind Task's "search by meaning" feature.

## The Problem with Keyword Search

Traditional search looks for exact word matches. Search for "authentication
bugs" and you'll only find tasks containing those words. Tasks about "login
issues" or "auth problems" won't appear.

This is frustrating because we think in concepts, not keywords.

## Embeddings: Meaning as Numbers

Semantic search solves this by converting text into vectors—lists of numbers
that represent meaning.

The sentence "fix the login bug" becomes something like:

```
[0.023, -0.156, 0.089, 0.234, ..., -0.045]  # 768 dimensions
```

Similar meanings produce similar vectors. "Fix authentication issues" would have
a vector close to the one above, even though the words are different.

## How Task CLI Uses Embeddings

When you create a task:

1. The task title, description, and tags are sent to an embedding provider
2. The provider returns a 768-dimension vector
3. The vector is stored in a separate per-database `embeddings.db` file,
   attached to the main connection as the `emb` schema

When you search:

1. Your query is converted to a vector using the same provider
2. SQLite compares this vector to all task vectors
3. Tasks with similar vectors (cosine similarity) are returned

## Embedding Providers

Task CLI supports three providers:

| Provider | Location | Cost               | Accuracy  |
| -------- | -------- | ------------------ | --------- |
| Ollama   | Local    | Free               | Good      |
| OpenAI   | Cloud    | ~$0.0001/1K tokens | Excellent |
| Gemini   | Cloud    | Free tier          | Excellent |

**Ollama** runs on your machine using the `nomic-embed-text` model. No data
leaves your computer.

**OpenAI** and **Gemini** send task text to their APIs. More accurate, but your
task content goes to their servers.

## Vector Storage

Vectors are stored as `F32_BLOB`—32-bit floating point numbers packed into a
binary blob—using libsql's native vector support:

- `vector_top_k()`: Find the k most similar vectors via a DiskANN index
- `vector_distance_cos()`: Cosine distance between two vectors

The query looks like:

```sql
SELECT v.id, vector_distance_cos(e.embedding, vector(?)) AS distance
FROM vector_top_k('emb.task_embeddings_idx', vector(?), 10) v
JOIN emb.task_embeddings e ON e.task_id = v.id
JOIN tasks t ON t.id = v.id
```

Vectors and their DiskANN index live in `embeddings.db`, separate from the
synced `data.db`, because they're large and fully rebuildable — `task sync`
stays fast and the git history stays small. Deleting a task removes its vectors,
and the search query joins `tasks` to filter any leftovers.

Each database records which provider/model generated its vectors. Switching
providers clears the index (vectors from different models aren't comparable) and
`task embeddings backfill` rebuilds it.

## Fire-and-Forget Generation

Embedding generation is asynchronous. When you create a task:

1. Task is immediately saved to the database
2. Embedding request is queued
3. API returns success
4. (In background) Embedding is generated and stored

This means very recent tasks might not appear in semantic search. In practice,
embeddings complete within seconds.

## Accuracy vs. Speed Trade-offs

**Cloud providers (OpenAI, Gemini):**

- More accurate embeddings from larger models
- Requires network round-trip
- Your data is sent externally

**Local provider (Ollama):**

- Faster (no network)
- Data stays local
- Slightly less accurate

For most task descriptions, the accuracy difference is negligible. The privacy
and speed benefits of Ollama often outweigh the accuracy improvement from cloud
providers.

## Limitations

**Short text:** Embeddings work best with substantial text. A one-word task
title doesn't give the model much to work with.

**Domain-specific jargon:** Generic embedding models might not understand
specialized terminology. "Fix the k8s ingress" might not match "Kubernetes
networking issue" as well as you'd hope.

**Semantic drift:** If you search for "urgent tasks," you might get tasks about
urgent matters, not necessarily tasks marked as urgent. The model doesn't
understand your priority system.

## When to Use Semantic vs. Keyword Search

**Use semantic search (`--semantic`) when:**

- You're looking for conceptually related tasks
- You don't remember the exact wording
- You want to explore what tasks might be relevant

**Use keyword search (`-q`) when:**

- You know the exact words in the task
- You're filtering by specific terminology
- Speed is more important than recall
