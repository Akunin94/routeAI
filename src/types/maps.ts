export interface MapViewport {
  center: { lat: number; lng: number }
  zoom: number
}

export interface PlaceResult {
  placeId: string
  address: string
  location: { lat: number; lng: number }
  name?: string
}
