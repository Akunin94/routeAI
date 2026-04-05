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

  let body: { address?: string; existing?: string[] }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { address, existing } = body

  if (!address || typeof address !== 'string') {
    return new Response(
      JSON.stringify({ error: '"address" is required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  if (!existing?.length) {
    return new Response(
      JSON.stringify({ duplicate: false, match: null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const list = existing.slice(0, 20).map((a, i) => `${i + 1}. ${a}`).join('\n')

  const systemPrompt = `You are a duplicate address detector for a logistics application.
Given a new address and a list of existing addresses, determine if the new address is likely a duplicate of any existing one.

Consider these as duplicates:
- Same address with abbreviations ("St" vs "Street", "Ave" vs "Avenue", "Blvd" vs "Boulevard")
- Same address with/without unit/suite numbers when the street matches
- Minor typos in street names
- Same address formatted differently

Return raw JSON only, no markdown:
{
  "duplicate": boolean,
  "match": string | null,
  "reason": string | null
}

"match" should be the exact string from the existing list that matches.
"reason" should be a short explanation (max 80 chars).
Be conservative — only flag high-confidence duplicates.`

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
      messages: [{
        role: 'user',
        content: `New address: "${address}"\n\nExisting addresses:\n${list}`,
      }],
    }),
  })

  if (!res.ok) {
    return new Response(
      JSON.stringify({ duplicate: false, match: null }),
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
      JSON.stringify({ duplicate: false, match: null }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
}
