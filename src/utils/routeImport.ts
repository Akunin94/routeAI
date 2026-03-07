import { loadGoogleMaps } from '@/services/googleMapsService'

export interface ParsedWaypoint {
  address: string
  lat?: number
  lng?: number
}

/**
 * Parse uploaded file content.
 * Supports:
 *  1. Our own exported TSV ("Route Export" header) — coordinates included
 *  2. Simple list — one address per line, or TSV/CSV where first non-numeric column is the address
 */
export function parseFile(content: string): ParsedWaypoint[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  if (lines[0] === 'Route Export') {
    return parseExportedTsv(lines)
  }
  return parseAddressList(lines)
}

function parseExportedTsv(lines: string[]): ParsedWaypoint[] {
  const sectionIdx = lines.findIndex(l => l === 'Waypoints')
  if (sectionIdx === -1) return []

  const result: ParsedWaypoint[] = []
  // skip header row (sectionIdx + 1)
  for (let i = sectionIdx + 2; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line === 'Route Steps') break
    const cols = line.split('\t')
    if (cols.length >= 5) {
      const lat = parseFloat(cols[3])
      const lng = parseFloat(cols[4])
      result.push({ address: cols[2], lat: isNaN(lat) ? undefined : lat, lng: isNaN(lng) ? undefined : lng })
    }
  }
  return result
}

function parseAddressList(lines: string[]): ParsedWaypoint[] {
  // Skip header row if first line looks like a label
  const firstCols = lines[0].split(/\t|,/)
  const looksLikeHeader = /^(address|stop|waypoint|name|location|#|№)/i.test(firstCols[0].trim())
  const dataLines = looksLikeHeader ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split('\t')
    // If first column is a number (index), use second column as address
    const address = cols.length >= 2 && /^\d+$/.test(cols[0].trim())
      ? cols[1].trim()
      : cols[0].trim()
    return { address }
  }).filter(w => w.address.length > 2)
}

/**
 * Resolve coordinates for waypoints that don't have them yet.
 * Returns only successfully geocoded waypoints; throws on complete failure.
 */
export async function resolveCoordinates(
  waypoints: ParsedWaypoint[],
  onProgress?: (done: number, total: number) => void,
): Promise<Array<{ address: string; lat: number; lng: number }>> {
  await loadGoogleMaps()
  const geocoder = new google.maps.Geocoder()
  const results: Array<{ address: string; lat: number; lng: number }> = []
  const errors: string[] = []

  for (const [i, wp] of waypoints.entries()) {
    if (wp.lat !== undefined && wp.lng !== undefined) {
      results.push({ address: wp.address, lat: wp.lat, lng: wp.lng })
    } else {
      try {
        const { results: geoResults } = await geocoder.geocode({ address: wp.address })
        const loc = geoResults[0]?.geometry?.location
        if (!loc) throw new Error('No results')
        results.push({ address: wp.address, lat: loc.lat(), lng: loc.lng() })
      } catch {
        errors.push(wp.address)
      }
    }
    onProgress?.(i + 1, waypoints.length)
  }

  if (results.length === 0) {
    throw new Error(`Could not geocode any addresses. Failed: ${errors.join(', ')}`)
  }
  if (errors.length > 0) {
    console.warn('Could not geocode:', errors)
  }
  return results
}
