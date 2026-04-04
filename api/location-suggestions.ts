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

interface NumberSuggestionField {
  value: number
  confidence: number
  source?: 'places' | 'ai'
}

interface LocationSuggestions {
  alias: SuggestionField
  phone?: SuggestionField
  email?: SuggestionField
  time_windows?: TimeWindow[]
  timezone?: SuggestionField
  service_time?: NumberSuggestionField
  stop_type?: SuggestionField
}

function formatTime(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`
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

async function findPlaceByCoords(address: string, lat: number, lng: number, apiKey: string): Promise<PlacesData | null> {
  // nearbysearch to get candidates near coords, then pick one whose vicinity matches the address
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) return null

  const data = await res.json() as {
    status: string
    results?: Array<{ place_id: string; name: string; vicinity: string; types: string[] }>
  }
  if (data.status !== 'OK' || !data.results?.length) return null

  // Normalize address for comparison: lowercase, strip punctuation
  const normalize = (s: string) => s.toLowerCase().replace(/[.,#-]/g, '').replace(/\s+/g, ' ').trim()
  const normalizedAddress = normalize(address)

  // Pick first result whose vicinity overlaps with address, skip pure street_address results
  const match = data.results.find((r) => {
    if (!r.types || r.types.every(t => t === 'street_address' || t === 'route')) return false
    const normalizedVicinity = normalize(r.vicinity)
    // Check if the street number + street name from address appears in vicinity
    const addressParts = normalizedAddress.split(' ').slice(0, 3)
    return addressParts.some(part => part.length > 2 && normalizedVicinity.includes(part))
  })

  if (!match) return null
  return fetchPlacesDetails(match.place_id, apiKey)
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

// Map Google Places types to R4m stop types and estimated service time (seconds)
function inferFromPlaceTypes(types: string[]): { stop_type?: string; service_time?: number } {
  const typeSet = new Set(types)

  if (typeSet.has('restaurant') || typeSet.has('cafe') || typeSet.has('food')) {
    return { stop_type: 'DELIVERY', service_time: 900 } // 15 min
  }
  if (typeSet.has('grocery_or_supermarket') || typeSet.has('supermarket')) {
    return { stop_type: 'DELIVERY', service_time: 1200 } // 20 min
  }
  if (typeSet.has('hospital') || typeSet.has('doctor') || typeSet.has('health')) {
    return { stop_type: 'SERVICE', service_time: 2700 } // 45 min
  }
  if (typeSet.has('store') || typeSet.has('shopping_mall') || typeSet.has('department_store')) {
    return { stop_type: 'DELIVERY', service_time: 900 }
  }
  if (typeSet.has('warehouse') || typeSet.has('storage')) {
    return { stop_type: 'PICKUP', service_time: 1800 } // 30 min
  }
  if (typeSet.has('school') || typeSet.has('university')) {
    return { stop_type: 'DELIVERY', service_time: 600 } // 10 min
  }
  if (typeSet.has('gas_station') || typeSet.has('car_repair')) {
    return { stop_type: 'SERVICE', service_time: 1200 }
  }
  if (typeSet.has('lodging') || typeSet.has('hotel')) {
    return { stop_type: 'DELIVERY', service_time: 600 }
  }

  return {}
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

  if (claudeSuggestions.email?.value) {
    result.email = {
      value: claudeSuggestions.email.value,
      confidence: claudeSuggestions.email.confidence ?? 0.7,
      source: 'ai',
    }
  }

  if (places?.opening_hours?.periods?.length) {
    const windows: TimeWindow[] = places.opening_hours.periods
      .filter((p) => p.close)
      .map((p) => ({
        start: formatTime(p.open.time),
        end: formatTime(p.close!.time),
        confidence: 0.9,
        source: 'places' as const,
      }))

    if (windows.length > 0) result.time_windows = windows
  }

  if (timezone) {
    result.timezone = { value: timezone, confidence: 0.99, source: 'places' }
  }

  if (places?.types?.length) {
    const inferred = inferFromPlaceTypes(places.types)

    if (inferred.stop_type) {
      result.stop_type = { value: inferred.stop_type, confidence: 0.75, source: 'ai' }
    }
    if (inferred.service_time) {
      result.service_time = { value: inferred.service_time, confidence: 0.65, source: 'ai' }
    }
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
