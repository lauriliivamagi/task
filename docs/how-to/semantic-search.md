# How to Set Up Semantic Search

Search tasks by meaning instead of exact keywords.

## Choose an embedding provider

| Provider | Setup              | Cost                |
| -------- | ------------------ | ------------------- |
| Ollama   | Local installation | Free                |
| OpenAI   | API key required   | Pay per use         |
| Gemini   | API key required   | Free tier available |

## Option 1: Ollama (local, free)

Install Ollama:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
```

Configure Task:

```bash
export EMBEDDING_PROVIDER=ollama
```

Optionally set custom URL (default: http://localhost:11434):

```bash
export OLLAMA_URL=http://localhost:11434
```

## Option 2: OpenAI

Get an API key from [OpenAI](https://platform.openai.com/api-keys).

```bash
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=sk-...
```

## Option 3: Google Gemini

Get an API key from
[Google AI Studio](https://makersuite.google.com/app/apikey).

```bash
export EMBEDDING_PROVIDER=gemini
export GEMINI_API_KEY=...
```

## Generate embeddings for existing tasks

```bash
task embeddings backfill
```

This processes all tasks that don't have embeddings yet.

## Search by meaning

```bash
task list --semantic "authentication problems"
task list -s "urgent customer issues" --limit 5
```

## Check embedding status

```bash
task embeddings status    # Coverage statistics
task embeddings provider  # Current provider
```

## How it works

- New tasks get embeddings automatically (fire-and-forget)
- 768-dimension vectors stored in SQLite
- Search uses cosine similarity to find related tasks
- Works on task titles and descriptions
