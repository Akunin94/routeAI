import { ref } from 'vue'
import type { PlaceResult } from '@/types/maps'
import { loadGoogleMaps } from '@/services/googleMapsService'

export function usePlacesAutocomplete() {
  const selectedPlace = ref<PlaceResult | null>(null)

  async function initialize(inputElement: HTMLInputElement): Promise<() => void> {
    await loadGoogleMaps()

    const autocomplete = new google.maps.places.Autocomplete(inputElement, {
      fields: ['place_id', 'formatted_address', 'geometry', 'name'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location || !place.place_id) return

      selectedPlace.value = {
        placeId: place.place_id,
        address: place.formatted_address ?? place.name ?? '',
        location: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        },
        name: place.name,
      }
    })

    return () => google.maps.event.removeListener(listener)
  }

  function reset() {
    selectedPlace.value = null
  }

  return { selectedPlace, initialize, reset }
}
