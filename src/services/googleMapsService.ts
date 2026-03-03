import { Loader } from '@googlemaps/js-api-loader'
import type { Waypoint } from '@/types/waypoint'

let mapsPromise: Promise<void> | null = null

export function resetGoogleMaps(): void {
  mapsPromise = null
}

export function loadGoogleMaps(): Promise<void> {
  if (mapsPromise) return mapsPromise

  const loader = new Loader({
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
    version: 'weekly',
    libraries: ['places', 'geometry'],
    language: 'en',
  })

  mapsPromise = Promise.all([
    loader.importLibrary('maps'),
    loader.importLibrary('places'),
    loader.importLibrary('geometry'),
  ]).then(() => undefined)
  return mapsPromise
}

export async function calculateRoute(
  waypoints: Waypoint[],
  travelMode: google.maps.TravelMode = google.maps.TravelMode.DRIVING,
): Promise<google.maps.DirectionsResult> {
  await loadGoogleMaps()

  if (waypoints.length < 2) {
    throw new Error('At least 2 waypoints are required')
  }

  const origin = waypoints[0]
  const destination = waypoints[waypoints.length - 1]
  const stops = waypoints.slice(1, -1)

  const directionsService = new google.maps.DirectionsService()

  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin: { lat: origin.location.lat, lng: origin.location.lng },
        destination: { lat: destination.location.lat, lng: destination.location.lng },
        waypoints: stops.map((wp) => ({
          location: { lat: wp.location.lat, lng: wp.location.lng },
          stopover: true,
        })),
        optimizeWaypoints: false, // Claude handles optimization
        travelMode,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result)
        } else {
          reject(new Error(`Directions request failed: ${status}`))
        }
      },
    )
  })
}
