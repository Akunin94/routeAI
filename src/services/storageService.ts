import type { SavedRoute } from '@/types/route'

const STORAGE_KEY = 'route_planner_saved_routes'

export function loadRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedRoute[]
  } catch {
    return []
  }
}

export function persistRoutes(routes: SavedRoute[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routes))
  } catch {
    throw new Error('Failed to save routes: localStorage quota exceeded or unavailable')
  }
}
