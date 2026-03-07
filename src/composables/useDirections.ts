import { ref } from 'vue'
import type { Ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { calculateRoute } from '@/services/googleMapsService'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'
import type { Route, RouteLeg, RouteStep } from '@/types/route'

export function useDirections(mapInstance: Ref<google.maps.Map | null>) {
  const waypointStore = useWaypointStore()
  const routeStore = useRouteStore()
  const rendererRef = ref<google.maps.DirectionsRenderer | null>(null)

  function _ensureRenderer(): google.maps.DirectionsRenderer | null {
    if (!mapInstance.value) return null

    if (!rendererRef.value) {
      rendererRef.value = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#1976D2',
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      })
      rendererRef.value.setMap(mapInstance.value)
    }

    return rendererRef.value
  }

  async function renderRoute() {
    if (!waypointStore.hasEnoughWaypoints) return

    const renderer = _ensureRenderer()
    if (!renderer) return

    routeStore.setCalculating(true)

    try {
      const mode = google.maps.TravelMode[routeStore.travelMode]
      const result = await calculateRoute(waypointStore.waypoints, mode)
      renderer.setDirections(result)

      const legs = result.routes[0].legs
      const routeLegs: RouteLeg[] = legs.map((leg) => ({
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        distance: { text: leg.distance?.text ?? '', value: leg.distance?.value ?? 0 },
        duration: { text: leg.duration?.text ?? '', value: leg.duration?.value ?? 0 },
        steps: leg.steps.map(
          (step): RouteStep => ({
            instruction: step.instructions,
            distance: step.distance?.text ?? '',
            duration: step.duration?.text ?? '',
          }),
        ),
      }))

      const totalDistance = legs.reduce((acc, leg) => acc + (leg.distance?.value ?? 0), 0)
      const totalDuration = legs.reduce((acc, leg) => acc + (leg.duration?.value ?? 0), 0)

      const route: Route = {
        id: uuidv4(),
        waypoints: [...waypointStore.waypoints],
        legs: routeLegs,
        totalDistance: {
          text: _formatDistance(totalDistance),
          value: totalDistance,
        },
        totalDuration: {
          text: _formatDuration(totalDuration),
          value: totalDuration,
        },
        overviewPolyline: result.routes[0].overview_polyline ?? '',
        createdAt: Date.now(),
      }

      routeStore.setActiveRoute(route)
      routeStore.setCalculating(false)

      const bounds = new google.maps.LatLngBounds()
      waypointStore.waypoints.forEach((wp) => bounds.extend(wp.location))
      mapInstance.value?.fitBounds(bounds, 60)
    } catch (err) {
      routeStore.setError(err instanceof Error ? err.message : 'Failed to calculate route')
    }
  }

  function clearRoute() {
    rendererRef.value?.setMap(null)
    rendererRef.value = null
    routeStore.clearRoute()
  }

  return { renderRoute, clearRoute, rendererRef }
}

function _formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function _formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}
