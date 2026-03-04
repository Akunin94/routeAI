import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { loadGoogleMaps, resetGoogleMaps } from '@/services/googleMapsService'

type WindowWithGmAuth = Window & { gm_authFailure?: () => void }

export function useGoogleMaps(mapContainerRef: Ref<HTMLElement | null>) {
  const mapInstance = shallowRef<google.maps.Map | null>(null)
  const isLoaded = ref(false)
  const loadError = ref<string | null>(null)

  const MAP_OPTIONS: google.maps.MapOptions = {
    center: { lat: 40.7128, lng: -74.006 },
    zoom: 12,
    mapTypeControl: false,
    fullscreenControl: false,
    streetViewControl: false,
    zoomControl: false,
  }

  // Google Maps fires this global callback when the API key is invalid/unauthorized
  const _prevAuthFailure = (window as WindowWithGmAuth).gm_authFailure
  ;(window as WindowWithGmAuth).gm_authFailure = () => {
    loadError.value = 'Google Maps API key is invalid or unauthorized'
    isLoaded.value = false
    mapInstance.value = null
    _prevAuthFailure?.()
  }

  onUnmounted(() => {
    ;(window as WindowWithGmAuth).gm_authFailure = _prevAuthFailure
  })

  async function _initialize() {
    if (!mapContainerRef.value) return
    loadError.value = null
    isLoaded.value = false

    try {
      await loadGoogleMaps()
      mapInstance.value = new google.maps.Map(mapContainerRef.value, MAP_OPTIONS)
      isLoaded.value = true
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load Google Maps'
    }
  }

  async function retry() {
    resetGoogleMaps()
    await _initialize()
  }

  onMounted(_initialize)

  return { mapInstance, isLoaded, loadError, retry }
}
