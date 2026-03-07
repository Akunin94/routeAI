import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Route } from '@/types/route'
import type { TravelMode } from '@/types/maps'

export const useRouteStore = defineStore('route', () => {
  const activeRoute = ref<Route | null>(null)
  const alternativeRoutes = ref<Route[]>([])
  const isCalculating = ref(false)
  const error = ref<string | null>(null)
  const travelMode = ref<TravelMode>('DRIVING')

  function setActiveRoute(route: Route) {
    activeRoute.value = route
    error.value = null
  }

  function setAlternativeRoutes(routes: Route[]) {
    alternativeRoutes.value = routes
  }

  function setCalculating(value: boolean) {
    isCalculating.value = value
  }

  function setError(message: string) {
    error.value = message
    isCalculating.value = false
  }

  function clearRoute() {
    activeRoute.value = null
    alternativeRoutes.value = []
    error.value = null
  }

  function setTravelMode(mode: TravelMode) {
    travelMode.value = mode
  }

  return {
    activeRoute,
    alternativeRoutes,
    isCalculating,
    error,
    travelMode,
    setActiveRoute,
    setAlternativeRoutes,
    setCalculating,
    setError,
    clearRoute,
    setTravelMode,
  }
})
