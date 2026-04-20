import type { tourRoutes, tours } from "@/lib/db/schema"
import type { GeneratedRoute, SavedTour } from "@/lib/tour"

type PointRow = {
  lat: number
  lng: number
  label: string | null
}

type RouteRow = typeof tourRoutes.$inferSelect | null

type TourRow = typeof tours.$inferSelect & {
  points: PointRow[]
  route: RouteRow
}

function toGeneratedRoute(route: RouteRow): GeneratedRoute | null {
  if (!route) {
    return null
  }

  return {
    provider: "openrouteservice",
    distanceM: route.distanceM,
    durationS: route.durationS,
    ascentM: route.ascentM,
    descentM: route.descentM,
    geometry: route.geometry as GeneratedRoute["geometry"],
  }
}

export function serializeTour(tour: TourRow): SavedTour {
  return {
    id: tour.id,
    title: tour.title,
    routeMode: tour.routeMode,
    waypoints: tour.points.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      label: point.label ?? undefined,
    })),
    route: toGeneratedRoute(tour.route),
    createdAt: tour.createdAt.toISOString(),
    updatedAt: tour.updatedAt.toISOString(),
  }
}
