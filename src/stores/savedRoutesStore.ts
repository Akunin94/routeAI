import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SavedRoute } from '@/types/route'

const STORAGE_KEY = 'route_planner_saved_routes'

export const useSavedRoutesStore = defineStore('savedRoutes', () => {
  const routes = ref<SavedRoute[]>(_loadFromStorage())
  const storageError = ref<string | null>(null)

  function saveRoute(route: SavedRoute) {
    routes.value.unshift(route)
    _persist()
  }

  function deleteRoute(id: string) {
    routes.value = routes.value.filter(r => r.id !== id)
    _persist()
  }

  function _loadFromStorage(): SavedRoute[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as SavedRoute[]) : []
    } catch {
      return []
    }
  }

  function _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(routes.value))
      storageError.value = null
    } catch {
      storageError.value = 'Could not save route: storage quota exceeded'
    }
  }

  return {
    routes,
    storageError,
    saveRoute,
    deleteRoute,
  }
})
