import { ref, onMounted } from 'vue'
import type { Ref } from 'vue'
import { loadGoogleMaps } from '@/services/googleMapsService'

export function useGoogleMaps(mapContainerRef: Ref<HTMLElement | null>) {
  const mapInstance = ref<google.maps.Map | null>(null)
  const isLoaded = ref(false)
  const loadError = ref<string | null>(null)

  onMounted(async () => {
    if (!mapContainerRef.value) return

    try {
      await loadGoogleMaps()

      mapInstance.value = new google.maps.Map(mapContainerRef.value, {
        center: { lat: 40.7128, lng: -74.006 },
        zoom: 12,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      })

      isLoaded.value = true
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load Google Maps'
    }
  })

  return { mapInstance, isLoaded, loadError }
}
