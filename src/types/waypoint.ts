export interface Waypoint {
  id: string
  label: string           // "Origin", "Stop 1", "Destination"
  address: string
  placeId?: string
  location: { lat: number; lng: number }
  order: number
  isOrigin: boolean
  isDestination: boolean
}
