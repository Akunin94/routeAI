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
  types?: string[]
  opening_hours?: {
    periods?: Array<{
      open: { day: number; time: string }
      close?: { day: number; time: string }
    }>
  }
}

interface SuggestionField {
  value: string
  confidence: number
  source?: 'places' | 'ai'
}

interface LocationSuggestions {
  alias: SuggestionField
  phone?: SuggestionField
  timezone?: SuggestionField
}

async function fetchPlacesDetails(placeId: string, apiKey: string): Promise<PlacesData | null> {
  const fields = 'name,formatted_phone_number,website,opening_hours,types'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${encodeURIComponent(fields)}&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as { status: string; result?: PlacesData }
  if (data.status !== 'OK' || !data.result) return null

  return data.result
}

async function findPlaceIdByAddress(address: string, apiKey: string, locationBias?: string): Promise<string | null> {
  let url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=place_id&key=${apiKey}`
  if (locationBias) url += `&locationbias=${encodeURIComponent(locationBias)}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as { status: string; candidates?: Array<{ place_id: string }> }
  if (data.status !== 'OK' || !data.candidates?.length) return null

  return data.candidates[0].place_id
}

async function findPlaceByAddress(address: string, apiKey: string): Promise<PlacesData | null> {
  const placeId = await findPlaceIdByAddress(address, apiKey)
  if (!placeId) return null
  return fetchPlacesDetails(placeId, apiKey)
}

async function findPlaceByCoords(_address: string, lat: number, lng: number, apiKey: string): Promise<PlacesData | null> {
  // Search within 50m, pick the first result that has opening_hours in Details
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&rankby=prominence&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as {
    status: string
    results?: Array<{ place_id: string; name: string; types: string[] }>
  }
  if (data.status !== 'OK' || !data.results?.length) return null

  // Try up to 3 closest results, return first one that has opening_hours.periods
  const candidates = data.results.slice(0, 3)
  for (const candidate of candidates) {
    const details = await fetchPlacesDetails(candidate.place_id, apiKey)
    if (details?.opening_hours?.periods?.length) return details
  }

  // No match with hours — return first result anyway (for phone/alias/timezone)
  return fetchPlacesDetails(candidates[0].place_id, apiKey)
}

async function fetchTimezone(lat: number, lng: number, apiKey: string): Promise<string | null> {
  const timestamp = Math.floor(Date.now() / 1000)
  const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as { status: string; timeZoneId?: string }
  if (data.status !== 'OK' || !data.timeZoneId) return null

  return data.timeZoneId
}

async function generateWithClaude(
  address: string,
  places: PlacesData | null,
  apiKey: string,
): Promise<Partial<LocationSuggestions>> {
  const systemPrompt = `You are a helpful assistant that generates location metadata for a route management application.
Given an address and optional business data, return a JSON object with suggested values for location fields.

Rules:
- alias: short human-readable name (max 60 chars), derived from business name or street address
- email: only include if you can confidently infer from the website domain (e.g. website "https://acme.com" → "info@acme.com")
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
  if (places?.types?.length) userLines.push(`Business types: ${places.types.join(', ')}`)

  const userPrompt = userLines.join('\n') + '\n\nReturn raw JSON.'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`)

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}'

  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return { alias: { value: address.split(',')[0].trim().slice(0, 60), confidence: 0.5, source: 'ai' } }
  }
}

export default async function handler(req: Request): Promise<Response> {
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

  let body: { address?: string; place_id?: string; lat?: number; lng?: number }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { address, place_id, lat, lng } = body

  if (!address || typeof address !== 'string') {
    return new Response(
      JSON.stringify({ error: '"address" field is required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const hasCoords = lat !== undefined && lng !== undefined

  // Run Places lookup + timezone in parallel
  const [places, timezone] = await Promise.all([
    mapsKey
      ? hasCoords
        ? findPlaceByCoords(address, lat!, lng!, mapsKey)
        : place_id
          ? fetchPlacesDetails(place_id, mapsKey)
          : findPlaceByAddress(address, mapsKey)
      : Promise.resolve(null),
    mapsKey && hasCoords
      ? fetchTimezone(lat!, lng!, mapsKey)
      : Promise.resolve(null),
  ])

  // Claude for alias + email
  let claudeSuggestions: Partial<LocationSuggestions>
  try {
    claudeSuggestions = await generateWithClaude(address, places, claudeKey)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Claude request failed: ${String(err)}` }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const result: LocationSuggestions = {
    alias: {
      value: claudeSuggestions.alias?.value ?? address.split(',')[0].trim().slice(0, 60),
      confidence: claudeSuggestions.alias?.confidence ?? 0.6,
      source: 'ai',
    },
  }

  if (places?.formatted_phone_number) {
    result.phone = { value: places.formatted_phone_number, confidence: 0.95, source: 'places' }
  }

  // Email — only from Places website field if it contains an email directly (rare), skip AI guessing
  // (AI-guessed emails are unreliable and not verified)

  if (timezone) {
    result.timezone = { value: timezone, confidence: 0.99, source: 'places' }
  }


  return new Response(JSON.stringify({
    ...result,
    _debug: {
      places_found: !!places,
      places_name: places?.name ?? null,
      has_opening_hours: !!places?.opening_hours,
      periods_count: places?.opening_hours?.periods?.length ?? 0,
      types: places?.types ?? null,
    },
  }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
