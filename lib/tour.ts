import type { RouteMode } from "@/lib/db/schema"

export type Waypoint = {
  lat: number
  lng: number
  label?: string
}

export type RouteGeometry = {
  type: "LineString"
  coordinates: ([number, number] | [number, number, number])[]
}

export type GeneratedRoute = {
  provider: "openrouteservice"
  distanceM: number
  durationS: number
  ascentM: number
  descentM: number
  geometry: RouteGeometry
}

export type SavedTour = {
  id: string
  title: string
  routeMode: RouteMode
  waypoints: Waypoint[]
  route: GeneratedRoute | null
  createdAt: string
  updatedAt: string
}
