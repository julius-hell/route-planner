import type { RouteMode } from "@/lib/db/schema"

type Coordinate = {
  lat: number
  lng: number
}

export function getCoordinatesForRoute(
  waypoints: Coordinate[],
  routeMode: RouteMode
) {
  if (routeMode === "open") {
    return waypoints
  }

  if (waypoints.length < 2) {
    return waypoints
  }

  const firstPoint = waypoints[0]
  const lastPoint = waypoints[waypoints.length - 1]

  if (firstPoint.lat === lastPoint.lat && firstPoint.lng === lastPoint.lng) {
    return waypoints
  }

  return [...waypoints, firstPoint]
}

export type { Coordinate }
