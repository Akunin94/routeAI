import type { Waypoint } from './waypoint'

export interface RouteStep {
  instruction: string
  distance: string
  duration: string
}

export interface RouteLeg {
  startAddress: string
  endAddress: string
  distance: { text: string; value: number }
  duration: { text: string; value: number }
  durationInTraffic?: { text: string; value: number }
  steps: RouteStep[]
}

export interface Route {
  id: string
  waypoints: Waypoint[]
  legs: RouteLeg[]
  totalDistance: { text: string; value: number }
  totalDuration: { text: string; value: number }
  overviewPolyline: string
  createdAt: number
}

export interface SavedRoute extends Route {
  name: string
  savedAt: number
}
