import "server-only"

/**
 * Keyless Exa search, over its public MCP endpoint.
 *
 * Exa exposes MCP as plain JSON-RPC over HTTP with an SSE-framed response, and
 * — verified against the live endpoint — `initialize`, `tools/list` and
 * `tools/call` all succeed with no API key. That is the only reason this can
 * run inside a Vercel function at all: the MCP servers wired into a developer's
 * editor are not reachable from production.
 *
 * Deliberately not `@mastra/mcp`. The protocol surface we need is one method
 * call, the repo already talks to Wikipedia, MDN, GitHub and HN through small
 * fetch wrappers in src/lib/lookup.ts, and adding a stateful MCP client would
 * mean debugging a second transport on serverless for no capability gain.
 */

const ENDPOINT = "https://mcp.exa.ai/mcp?client=skillforge"
const TIMEOUT_MS = 25_000

export type ExaResult = {
  title: string
  url: string
  /** Page highlights Exa extracted — enough to classify, not the whole page. */
  snippet: string
}

/**
 * Exa returns one text blob per call rather than structured results:
 *
 *   Title: How to Simplify DevOps using Docker | Alison
 *   URL: https://alison.com/course/...
 *   Published: N/A
 *   Author: N/A
 *   Highlights:
 *   ...
 *
 * Splitting on the `Title:` line recovers the records. A format change degrades
 * to zero results rather than to wrong ones, and `npm run check:discovery`
 * exists to catch that the moment it happens.
 */
function parseResults(text: string, limit: number): ExaResult[] {
  const blocks = text.split(/^Title:\s*/m).slice(1)
  const out: ExaResult[] = []

  for (const block of blocks) {
    const lines = block.split("\n")
    const title = lines[0]?.trim()
    const url = block.match(/^URL:\s*(\S+)/m)?.[1]?.trim()
    if (!title || !url) continue

    const highlights = block.split(/^Highlights:\s*$/m)[1] ?? ""
    const snippet = highlights
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l !== "..." && !/^#{1,6}\s/.test(l))
      .join(" ")
      .replace(/\s+/g, " ")
      .slice(0, 900)

    out.push({ title, url, snippet })
    if (out.length >= limit) break
  }

  return out
}

/**
 * One web search. Returns [] on any failure — a discovery run that finds
 * nothing is a normal outcome, and must never take down the analysis that
 * triggered it.
 */
export async function exaSearch(
  query: string,
  numResults = 6
): Promise<ExaResult[]> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Exa frames its JSON-RPC replies as SSE; without this it 406s.
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "web_search_exa",
          arguments: { query, numResults },
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(`[exa] HTTP ${response.status} for "${query}"`)
      return []
    }

    const body = await response.text()
    // One `data:` line per SSE message; the result rides on the last one.
    const payloads = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))

    for (const payload of payloads.reverse()) {
      let parsed: {
        result?: { content?: { type: string; text?: string }[] }
        error?: { message?: string }
      }
      try {
        parsed = JSON.parse(payload)
      } catch {
        continue
      }
      if (parsed.error) {
        console.error(`[exa] rpc error: ${parsed.error.message ?? "unknown"}`)
        return []
      }
      const text = parsed.result?.content?.find((c) => c.type === "text")?.text
      if (text) return parseResults(text, numResults)
    }

    return []
  } catch (err) {
    console.error(`[exa] search failed for "${query}":`, err)
    return []
  }
}
