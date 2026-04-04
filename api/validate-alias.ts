export const config = {
  runtime: 'edge',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
  }

  const claudeKey = process.env.CLAUDE_API_KEY
  if (!claudeKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  let body: { alias?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { alias } = body
  if (!alias || typeof alias !== 'string' || alias.trim().length < 3) {
    return new Response(
      JSON.stringify({ issue: null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const systemPrompt = `You are a validator for location aliases used in a route management application.
A location alias is a short human-readable name for a delivery/pickup address (max 60 chars).

Analyze the given alias and return JSON with this exact schema:
{
  "issue": "typo" | "unclear" | null,
  "suggestion": string | null,
  "reason": string | null
}

Rules:
- "typo": the alias contains a clear spelling mistake. Set "suggestion" to the corrected version.
- "unclear": the alias is too generic (e.g. "Store", "Office", "Location", "Address", "Place", "Building", "123") or is just a raw street number with no context.
- null: the alias looks fine — do NOT flag it.
- Be conservative — only flag obvious problems. If unsure, return null.
- "suggestion" should be a corrected alias (max 60 chars), or null if issue is "unclear".
- "reason" should be a short explanation (max 60 chars).
- Return raw JSON only, no markdown.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Alias: "${alias.trim()}"` }],
    }),
  })

  if (!res.ok) {
    return new Response(
      JSON.stringify({ issue: null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}'

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const result = JSON.parse(cleaned)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(
      JSON.stringify({ issue: null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
}
