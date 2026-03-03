import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { parseSuggestion, buildContext } from '@/composables/useRouteOptimizer'
import { useWaypointStore } from '@/stores/waypointStore'
import { useRouteStore } from '@/stores/routeStore'

const base = { address: 'A', location: { lat: 0, lng: 0 } }

describe('parseSuggestion', () => {
  it('returns null for text with no JSON block', () => {
    expect(parseSuggestion('Plain text response with no code block.')).toBeNull()
  })

  it('parses a valid reorder suggestion', () => {
    const text =
      'Here is my suggestion.\n```json\n{"type":"reorder","proposedOrder":["a","b"],"summary":"Better order"}\n```'
    expect(parseSuggestion(text)).toEqual({
      type: 'reorder',
      proposedOrder: ['a', 'b'],
      summary: 'Better order',
    })
  })

  it('parses a general suggestion', () => {
    const text = '```json\n{"type":"general","summary":"Looks good"}\n```'
    expect(parseSuggestion(text)).toEqual({ type: 'general', summary: 'Looks good' })
  })

  it('returns null for malformed JSON', () => {
    const text = '```json\n{invalid json here}\n```'
    expect(parseSuggestion(text)).toBeNull()
  })

  it('returns null for JSON missing required fields', () => {
    const text = '```json\n{"type":"reorder"}\n```'
    expect(parseSuggestion(text)).toBeNull()
  })

  it('uses the last JSON block when multiple exist', () => {
    const text =
      '```json\n{"type":"general","summary":"First"}\n```\nsome text\n```json\n{"type":"general","summary":"Last"}\n```'
    expect(parseSuggestion(text)?.summary).toBe('Last')
  })

  it('handles json block without language tag', () => {
    const text = '```\n{"type":"general","summary":"No tag"}\n```'
    expect(parseSuggestion(text)?.summary).toBe('No tag')
  })
})

describe('buildContext', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns placeholder when no waypoints', () => {
    const ws = useWaypointStore()
    const rs = useRouteStore()
    expect(buildContext(ws, rs)).toBe('No waypoints added yet.')
  })

  it('includes waypoint addresses', () => {
    const ws = useWaypointStore()
    const rs = useRouteStore()
    ws.addWaypoint({ address: 'Berlin', location: { lat: 52, lng: 13 } })
    ws.addWaypoint({ address: 'Munich', location: { lat: 48, lng: 11 } })
    const ctx = buildContext(ws, rs)
    expect(ctx).toContain('Berlin')
    expect(ctx).toContain('Munich')
  })

  it('states route not calculated when no active route', () => {
    const ws = useWaypointStore()
    const rs = useRouteStore()
    ws.addWaypoint(base)
    ws.addWaypoint({ address: 'B', location: { lat: 1, lng: 1 } })
    expect(buildContext(ws, rs)).toContain('not yet calculated')
  })

  it('includes route stats when active route is set', () => {
    const ws = useWaypointStore()
    const rs = useRouteStore()
    ws.addWaypoint(base)
    ws.addWaypoint({ address: 'B', location: { lat: 1, lng: 1 } })
    rs.setActiveRoute({
      id: 'r1',
      waypoints: [],
      legs: [],
      totalDistance: { text: '42 km', value: 42000 },
      totalDuration: { text: '30 min', value: 1800 },
      overviewPolyline: '',
      createdAt: 0,
    })
    const ctx = buildContext(ws, rs)
    expect(ctx).toContain('42 km')
    expect(ctx).toContain('30 min')
  })

  it('includes waypoint count in context', () => {
    const ws = useWaypointStore()
    const rs = useRouteStore()
    ws.addWaypoint(base)
    ws.addWaypoint({ address: 'B', location: { lat: 1, lng: 1 } })
    ws.addWaypoint({ address: 'C', location: { lat: 2, lng: 2 } })
    expect(buildContext(ws, rs)).toContain('3 total')
  })
})
