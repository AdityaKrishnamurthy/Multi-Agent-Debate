# 008 — Evidence Retrieval (RAG)

**Goal:** ground every argument in real, citable evidence. This is the "evidence-based" part of the title.

**Depends on:** 007
**Drift check:**
```bash
test -d backend/app/api && test -d backend/alembic && grep -q TAVILY_API_KEY .env.example \
  && grep -q '^TAVILY_API_KEY=.' .env && echo OK
```
**Allowed dependencies:** `httpx` (promoted to a runtime dependency; used for Tavily, Wikipedia, arXiv and Semantic Scholar), `sentence-transformers`, `pymupdf`.
**Done when:** every argument in a live debate shows clickable citations that open real source URLs, and uncited claims are visibly marked "unsupported".

## Sources
- Web search: Tavily API (free tier; needs `TAVILY_API_KEY`).
- Wikipedia REST API (needed for FEVER-style benchmarks).
- Papers: arXiv + Semantic Scholar APIs.
- User-uploaded PDFs (PyMuPDF).

## Pipeline
1. The Moderator decomposes the question into 3–5 **sub-claims**.
2. The Researcher/Explorer agent generates search queries per sub-claim. *Groq note:* tool calling and structured output can't be used in the same call, so the query-generation step returns JSON and the code runs the searches. No LLM tool calling is needed.
3. Fetch → clean → chunk (≈300–500 tokens, 50 overlap).
4. Embed locally (`bge-small-en-v1.5`) → store in **pgvector** (`evidence.embedding`).
5. Rerank the top-k with a cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`, loaded through sentence-transformers).
6. Each kept chunk becomes `Evidence(id="E#", source, url, quote, credibility)`.
7. Advocates receive the evidence pool, and **every claim must cite `E#` ids**. The schema enforces this: a claim that cites none is marked unsupported.

## Credibility score (simple, explainable)
`credibility = w1·source_type (paper > gov/edu > news > blog) + w2·reranker_score + w3·recency`, with the weights in config.

## Mid-debate retrieval
An agent may request more evidence once per round, by returning a `search_request` field that the engine fulfils. This makes rebuttals evidence-driven.

## Groq budget
Evidence chunks make prompts much longer, so put at most about 8 chunks in each prompt. Token use per debate will roughly double compared with 005/006.

## Steps
- [ ] Search, Wikipedia and arXiv clients with an on-disk/DB cache (the same query costs nothing the second time) → a test shows the second call hits the cache.
- [ ] PDF upload → chunk → embed → `/api/documents` returns the chunk count.
- [ ] Vector search + reranker → a test query returns the relevant chunk in the top 3.
- [ ] Evidence ids + citation enforcement in prompts and schemas.
- [ ] Evidence cards in the UI wired to real data.
