import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWaypointStore } from '@/stores/waypointStore'

const base = { address: '123 Main St', location: { lat: 40, lng: -74 } }
const addr = (a: string) => ({ address: a, location: { lat: 0, lng: 0 } })

describe('waypointStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addWaypoint', () => {
    it('first waypoint is origin', () => {
      const store = useWaypointStore()
      const wp = store.addWaypoint(base)
      expect(wp.isOrigin).toBe(true)
      expect(wp.isDestination).toBe(false)
      expect(wp.label).toBe('Origin')
    })

    it('second waypoint is destination', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      const wp = store.addWaypoint(addr('456 Elm St'))
      expect(wp.isOrigin).toBe(false)
      expect(wp.isDestination).toBe(true)
      expect(wp.label).toBe('Destination')
    })

    it('third waypoint is inserted before destination', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      store.addWaypoint(addr('456 Elm St'))
      store.addWaypoint(addr('789 Oak Ave'))
      expect(store.waypoints).toHaveLength(3)
      expect(store.waypoints[2].isDestination).toBe(true)
      expect(store.waypoints[1].isOrigin).toBe(false)
      expect(store.waypoints[1].isDestination).toBe(false)
    })

    it('assigns sequential ids', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      const w2 = store.addWaypoint(addr('B'))
      expect(w1.id).not.toBe(w2.id)
    })
  })

  describe('removeWaypoint', () => {
    it('removes waypoint by id', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      store.removeWaypoint(w1.id)
      expect(store.waypoints).toHaveLength(1)
      expect(store.waypoints.find(w => w.id === w1.id)).toBeUndefined()
    })

    it('does nothing for unknown id', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      store.removeWaypoint('nonexistent')
      expect(store.waypoints).toHaveLength(1)
    })

    it('recalculates origin after removing first waypoint', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      store.addWaypoint(addr('C'))
      store.removeWaypoint(w1.id)
      expect(store.waypoints[0].isOrigin).toBe(true)
      expect(store.waypoints[0].label).toBe('Origin')
    })
  })

  describe('reorderWaypoints', () => {
    it('reorders by provided id array', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      const w2 = store.addWaypoint(addr('B'))
      const w3 = store.addWaypoint(addr('C'))
      store.reorderWaypoints([w3.id, w1.id, w2.id])
      expect(store.waypoints[0].id).toBe(w3.id)
      expect(store.waypoints[1].id).toBe(w1.id)
      expect(store.waypoints[2].id).toBe(w2.id)
    })

    it('recalculates origin/destination labels after reorder', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      const w2 = store.addWaypoint(addr('B'))
      store.reorderWaypoints([w2.id, w1.id])
      expect(store.waypoints[0].isOrigin).toBe(true)
      expect(store.waypoints[0].label).toBe('Origin')
      expect(store.waypoints[1].isDestination).toBe(true)
      expect(store.waypoints[1].label).toBe('Destination')
    })
  })

  describe('computed', () => {
    it('hasEnoughWaypoints is false with 0 waypoints', () => {
      const store = useWaypointStore()
      expect(store.hasEnoughWaypoints).toBe(false)
    })

    it('hasEnoughWaypoints is false with 1 waypoint', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      expect(store.hasEnoughWaypoints).toBe(false)
    })

    it('hasEnoughWaypoints is true with 2+ waypoints', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      expect(store.hasEnoughWaypoints).toBe(true)
    })

    it('origin returns the first waypoint', () => {
      const store = useWaypointStore()
      const w1 = store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      expect(store.origin?.id).toBe(w1.id)
    })

    it('destination returns the last waypoint when 2+ exist', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      const w2 = store.addWaypoint(addr('B'))
      expect(store.destination?.id).toBe(w2.id)
    })

    it('stops returns intermediate waypoints', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      const stop = store.addWaypoint(addr('C'))
      expect(store.stops).toHaveLength(1)
      expect(store.stops[0].id).toBe(stop.id)
    })
  })

  describe('clearWaypoints', () => {
    it('empties the waypoints array', () => {
      const store = useWaypointStore()
      store.addWaypoint(base)
      store.addWaypoint(addr('B'))
      store.clearWaypoints()
      expect(store.waypoints).toHaveLength(0)
    })
  })
})
