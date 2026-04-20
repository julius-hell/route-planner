import type { SavedTour } from "@/lib/tour"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function toSafeFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
}

export function buildTourGpx(tour: SavedTour) {
  if (!tour.route) {
    throw new Error("Tour has no route")
  }

  const routeName = escapeXml(tour.title)

  const waypointsXml = tour.waypoints
    .map((point, index) => {
      const name = escapeXml(point.label ?? `Point ${index + 1}`)
      return `<wpt lat="${point.lat}" lon="${point.lng}"><name>${name}</name></wpt>`
    })
    .join("")

  const trackPointsXml = tour.route.geometry.coordinates
    .map((coordinate) => {
      const [lng, lat, ele] = coordinate

      if (typeof ele === "number") {
        return `<trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`
      }

      return `<trkpt lat="${lat}" lon="${lng}"></trkpt>`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Route Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName}</name>
  </metadata>
  ${waypointsXml}
  <trk>
    <name>${routeName}</name>
    <trkseg>
      ${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`
}
