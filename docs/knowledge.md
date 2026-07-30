# Agent knowledge

Personas can optionally load a local JSON knowledge file. The runtime matches an
entry's `id` or aliases against the triggering chat message and injects only the
matching facts into the LLM context.

```yaml
knowledge:
  enabled: true
  path: /app/config/knowledge.json
  maxResults: 3
  maxContextChars: 4000
```

Knowledge files use a persona-neutral format:

```json
{
  "version": "1",
  "entries": [
    {
      "id": "moon-garden",
      "aliases": ["lunar garden"],
      "content": "The garden opens after sunset."
    }
  ]
}
```

Keep deployment-specific data outside this repository and mount or copy it into
the runtime environment. `maxResults` and `maxContextChars` bound the amount of
reference text added to a request.
