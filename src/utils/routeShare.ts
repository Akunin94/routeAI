export interface SharePayload {
  waypoints: { address: string; lat: number; lng: number }[]
  mode: string
  time?: string
}

export function encodeSharePayload(payload: SharePayload): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const json = decodeURIComponent(escape(atob(encoded)))
    const data = JSON.parse(json) as SharePayload
    if (
      !Array.isArray(data.waypoints) ||
      data.waypoints.length < 2 ||
      !data.waypoints.every(
        (w) => typeof w.lat === 'number' && typeof w.lng === 'number',
      )
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}
