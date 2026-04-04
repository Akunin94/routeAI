export const config = {
  runtime: 'edge',
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

interface PlacesData {
  name?: string
  formatted_phone_number?: string
  website?: string
  opening_hours?: {
    periods?: Array<{
      open: { day: number; time: string }
      close?: { day: number; time: string }
    }>
  }
}

interface TimeWindow {
  start: string
  end: string
  confidence: number
  source: 'places' | 'ai'
}

interface SuggestionField {
  value: string
  confidence: number
  source?: 'places' | 'ai'
}

interface LocationSuggestions {
  alias: SuggestionField
  phone?: SuggestionField
  email?: SuggestionField
  time_windows?: TimeWindow[]
}

function formatTime(hhmm: string): string {
  // Places API returns time as "0900" → "09:00"
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
}

async function fetchPlacesDetails(placeId: string, apiKey: string): Promise<PlacesData | null> {
  const fields = 'name,formatted_phone_number,website,opening_hours'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as { status: string; result?: PlacesData }
  if (data.status !== 'OK' || !data.result) return null

  return data.result
}

async function generateWithClaude(
  address: string,
  places: PlacesData | null,
  apiKey: string,
): Promise<LocationSuggestions> {
  const systemPrompt = `You are a helpful assistant that generates location metadata for a route management application.
Given an address and optional business data, return a JSON object with suggested values for location fields.

Rules:
- alias: short human-readable name (max 60 chars), derived from business name or street address
- Only include fields you have reasonable confidence in
- Return raw JSON only, no markdown, no explanation

Output schema:
{
  "alias": { "value": string, "confidence": number },
  "email": { "value": string, "confidence": number }
}`

  const userLines: string[] = [`Address: ${address}`]
  if (places?.name) userLines.push(`Business name: ${places.name}`)
  if (places?.website) userLines.push(`Website: ${places.website}`)

  const userPrompt = userLines.join('\n') +
    '\n\nGenerate alias (always required) and email (only if confident from website domain). Return raw JSON.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Claude API error: ${res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}'

  try {
    return JSON.parse(text) as LocationSuggestions
  } catch {
    // Claude returned something unparseable — return minimal fallback
    return { alias: { value: address.split(',')[0].trim().slice(0, 60), confidence: 0.5 } }
  }
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
  }

  const claudeKey = process.env.CLAUDE_API_KEY
  const mapsKey = process.env.VITE_GOOGLE_MAPS_API_KEY

  if (!claudeKey) {
    return new Response(
      JSON.stringify({ error: 'Server misconfiguration: CLAUDE_API_KEY is not set' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  let body: { address?: string; place_id?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { address, place_id } = body

  if (!address || typeof address !== 'string') {
    return new Response(
      JSON.stringify({ error: '"address" field is required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Step 1: Fetch Places details (optional)
  let places: PlacesData | null = null
  if (place_id && mapsKey) {
    places = await fetchPlacesDetails(place_id, mapsKey)
  }

  // Step 2: Ask Claude for alias + email
  let claudeSuggestions: LocationSuggestions
  try {
    claudeSuggestions = await generateWithClaude(address, places, claudeKey)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Claude request failed: ${String(err)}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Step 3: Build final response, merging Places data with Claude output
  const result: LocationSuggestions = {
    alias: {
      value: claudeSuggestions.alias?.value ?? address.split(',')[0].trim().slice(0, 60),
      confidence: claudeSuggestions.alias?.confidence ?? 0.6,
      source: 'ai',
    },
  }

  // Phone — from Places only
  if (places?.formatted_phone_number) {
    result.phone = {
      value: places.formatted_phone_number,
      confidence: 0.95,
      source: 'places',
    }
  }

  // Email — from Claude (inferred from website) or skip
  if (claudeSuggestions.email?.value) {
    result.email = {
      value: claudeSuggestions.email.value,
      confidence: claudeSuggestions.email.confidence ?? 0.7,
      source: 'ai',
    }
  }

  // Time windows — from Places opening_hours.periods
  if (places?.opening_hours?.periods?.length) {
    const windows: TimeWindow[] = places.opening_hours.periods
      .filter((p) => p.close) // skip 24h open entries without close
      .map((p) => ({
        start: formatTime(p.open.time),
        end: formatTime(p.close!.time),
        confidence: 0.9,
        source: 'places' as const,
      }))

    if (windows.length > 0) {
      result.time_windows = windows
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
