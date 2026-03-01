import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { Waypoint } from '@/types/waypoint'

export const useWaypointStore = defineStore('waypoints', () => {
  const waypoints = ref<Waypoint[]>([])

  const origin = computed(() => waypoints.value.find(w => w.isOrigin) ?? null)
  const destination = computed(() => waypoints.value.find(w => w.isDestination) ?? null)
  const stops = computed(() => waypoints.value.filter(w => !w.isOrigin && !w.isDestination))
  const hasEnoughWaypoints = computed(() => waypoints.value.length >= 2)

  function addWaypoint(data: Omit<Waypoint, 'id' | 'order' | 'label' | 'isOrigin' | 'isDestination'>): Waypoint {
    const count = waypoints.value.length
    const isOrigin = count === 0
    const isDestination = count === 1

    // If adding a new stop when destination already exists — insert before destination
    if (!isOrigin && !isDestination && waypoints.value.length >= 2) {
      const destIndex = waypoints.value.findIndex(w => w.isDestination)
      const stopNumber = destIndex // stops before destination
      const newWaypoint: Waypoint = {
        ...data,
        id: uuidv4(),
        order: destIndex,
        label: `Stop ${stopNumber}`,
        isOrigin: false,
        isDestination: false,
      }
      waypoints.value.splice(destIndex, 0, newWaypoint)
      _recalculateOrder()
      return newWaypoint
    }

    const newWaypoint: Waypoint = {
      ...data,
      id: uuidv4(),
      order: count,
      label: isOrigin ? 'Origin' : isDestination ? 'Destination' : `Stop ${count - 1}`,
      isOrigin,
      isDestination,
    }
    waypoints.value.push(newWaypoint)
    return newWaypoint
  }

  function removeWaypoint(id: string) {
    const index = waypoints.value.findIndex(w => w.id === id)
    if (index === -1) return
    waypoints.value.splice(index, 1)
    _recalculateOrder()
  }

  function reorderWaypoints(orderedIds: string[]) {
    const map = new Map(waypoints.value.map(w => [w.id, w]))
    const reordered = orderedIds.map(id => map.get(id)).filter((w): w is Waypoint => !!w)
    waypoints.value = reordered
    _recalculateOrder()
  }

  function loadWaypoints(data: Waypoint[]) {
    waypoints.value = data
  }

  function clearWaypoints() {
    waypoints.value = []
  }

  function _recalculateOrder() {
    waypoints.value.forEach((w, i) => {
      w.order = i
      w.isOrigin = i === 0
      w.isDestination = i === waypoints.value.length - 1 && waypoints.value.length > 1
      if (w.isOrigin) {
        w.label = 'Origin'
      } else if (w.isDestination) {
        w.label = 'Destination'
      } else {
        w.label = `Stop ${i}`
      }
    })
  }

  return {
    waypoints,
    origin,
    destination,
    stops,
    hasEnoughWaypoints,
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,
    loadWaypoints,
    clearWaypoints,
  }
})
