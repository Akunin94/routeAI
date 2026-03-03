import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadRoutes, persistRoutes } from '@/services/storageService'
import type { SavedRoute } from '@/types/route'

const STORAGE_KEY = 'route_planner_saved_routes'

const mockRoute: SavedRoute = {
  id: 'r1',
  name: 'Test Route',
  waypoints: [],
  legs: [],
  totalDistance: { text: '0 km', value: 0 },
  totalDuration: { text: '0 min', value: 0 },
  overviewPolyline: '',
  createdAt: 1000,
  savedAt: 1000,
}

describe('storageService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('loadRoutes', () => {
    it('returns empty array when storage is empty', () => {
      expect(loadRoutes()).toEqual([])
    })

    it('returns parsed routes from storage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([mockRoute]))
      expect(loadRoutes()).toEqual([mockRoute])
    })

    it('returns empty array on invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json')
      expect(loadRoutes()).toEqual([])
    })

    it('returns empty array when item is null', () => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
      expect(loadRoutes()).toEqual([])
    })
  })

  describe('persistRoutes', () => {
    it('saves routes to localStorage', () => {
      persistRoutes([mockRoute])
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
      expect(stored).toEqual([mockRoute])
    })

    it('overwrites existing data', () => {
      persistRoutes([mockRoute])
      persistRoutes([])
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
      expect(stored).toEqual([])
    })

    it('throws when localStorage is full', () => {
      vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(() => persistRoutes([mockRoute])).toThrow('Failed to save routes')
    })
  })
})
