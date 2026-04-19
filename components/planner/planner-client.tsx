"use client"

import { useMemo, useState } from "react"
import type { Feature, LineString } from "geojson"
import maplibregl from "maplibre-gl"
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"

import { Button } from "@/components/ui/button"
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAX_WAYPOINTS,
} from "@/lib/constants"
import { formatDistance, formatDuration } from "@/lib/format"
import type { RouteMode } from "@/lib/db/schema"
import type { GeneratedRoute, SavedTour, Waypoint } from "@/lib/tour"

type PlannerClientProps = {
  initialTours: SavedTour[]
}

const routeLineStyle = {
  id: "route-line",
  type: "line",
  paint: {
    "line-color": "#f97316",
    "line-width": 4,
  },
} as const

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong"
}

export function PlannerClient({ initialTours }: PlannerClientProps) {
  const [tours, setTours] = useState(initialTours)
  const [routeMode, setRouteMode] = useState<RouteMode>("open")
  const [title, setTitle] = useState("")
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [route, setRoute] = useState<GeneratedRoute | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const geoJson = useMemo(() => {
    if (!route) {
      return null
    }

    const feature: Feature<LineString> = {
      type: "Feature",
      geometry: route.geometry,
      properties: {},
    }

    return {
      type: "FeatureCollection" as const,
      features: [feature],
    }
  }, [route])

  async function generateRoute() {
    if (waypoints.length < 2) {
      setError("Add at least two points to generate a route")
      return
    }

    setError(null)
    setIsGenerating(true)

    try {
      const response = await fetch("/api/routes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routeMode,
          waypoints: waypoints.map((point) => ({
            lat: point.lat,
            lng: point.lng,
          })),
        }),
      })

      const data = (await response.json().catch(() => null)) as {
        route?: GeneratedRoute
        error?: string
      } | null

      if (!response.ok || !data?.route) {
        throw new Error(data?.error ?? "Could not generate route")
      }

      setRoute(data.route)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsGenerating(false)
    }
  }

  async function saveTour() {
    if (!route) {
      setError("Generate a route before saving")
      return
    }

    if (!title.trim()) {
      setError("Please provide a title")
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const response = await fetch("/api/tours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          routeMode,
          waypoints,
          route,
        }),
      })

      const data = (await response.json().catch(() => null)) as {
        tour?: SavedTour
        error?: string
      } | null

      if (!response.ok || !data?.tour) {
        throw new Error(data?.error ?? "Could not save tour")
      }

      setTours((currentTours) => [data.tour as SavedTour, ...currentTours])
      setTitle("")
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteTour(tourId: string) {
    setError(null)

    try {
      const response = await fetch(`/api/tours/${tourId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Could not delete tour")
      }

      setTours((currentTours) =>
        currentTours.filter((tourItem) => tourItem.id !== tourId)
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  function loadTour(tour: SavedTour) {
    setTitle(tour.title)
    setRouteMode(tour.routeMode)
    setWaypoints(tour.waypoints)
    setRoute(tour.route)
    setError(null)
  }

  function clearPlanner() {
    setWaypoints([])
    setRoute(null)
    setTitle("")
    setError(null)
  }

  function removeWaypoint(index: number) {
    setWaypoints((currentPoints) =>
      currentPoints.filter((_, pointIndex) => pointIndex !== index)
    )
    setRoute(null)
  }

  function onMapClick(event: MapLayerMouseEvent) {
    if (waypoints.length >= MAX_WAYPOINTS) {
      setError(`You can add up to ${MAX_WAYPOINTS} points`)
      return
    }

    setError(null)
    setRoute(null)
    setWaypoints((currentPoints) => [
      ...currentPoints,
      {
        lat: event.lngLat.lat,
        lng: event.lngLat.lng,
      },
    ])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <aside className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-2">
          <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Route mode
          </p>
          <div className="flex gap-2">
            <Button
              variant={routeMode === "open" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRouteMode("open")
                setRoute(null)
              }}
            >
              Open
            </Button>
            <Button
              variant={routeMode === "round_trip" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRouteMode("round_trip")
                setRoute(null)
              }}
            >
              Round Trip
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {routeMode === "round_trip"
              ? "Round trip auto-closes back to the first point"
              : "Open routes end at the last selected point"}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="tour-title"
            className="text-xs tracking-[0.12em] text-muted-foreground uppercase"
          >
            Tour title
          </label>
          <input
            id="tour-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sunday Long Ride"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
              Waypoints
            </p>
            <span className="text-xs text-muted-foreground">
              {waypoints.length}/{MAX_WAYPOINTS}
            </span>
          </div>

          <div className="max-h-48 space-y-2 overflow-auto pr-1">
            {waypoints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Click on the map to add points.
              </p>
            ) : null}

            {waypoints.map((point, index) => (
              <div
                key={`${point.lat}-${point.lng}-${index}`}
                className="flex items-center justify-between rounded-md border border-border p-2 text-xs"
              >
                <span>
                  #{index + 1} {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={() => removeWaypoint(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={generateRoute}
            disabled={isGenerating || waypoints.length < 2}
          >
            {isGenerating ? "Generating..." : "Generate Route"}
          </Button>
          <Button
            variant="outline"
            onClick={saveTour}
            disabled={isSaving || !route}
          >
            {isSaving ? "Saving..." : "Save Tour"}
          </Button>
          <Button variant="ghost" onClick={clearPlanner}>
            Clear
          </Button>
        </div>

        {route ? (
          <div className="rounded-md border border-border bg-background p-3 text-sm">
            <p className="font-medium">Route stats</p>
            <p className="text-muted-foreground">
              Distance: {formatDistance(route.distanceM)}
            </p>
            <p className="text-muted-foreground">
              Estimated time: {formatDuration(route.durationS)}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Saved tours
          </p>
          <div className="max-h-56 space-y-2 overflow-auto pr-1">
            {tours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved tours yet.
              </p>
            ) : null}

            {tours.map((tourItem) => (
              <div
                key={tourItem.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <p className="font-medium">{tourItem.title}</p>
                <p className="text-xs text-muted-foreground">
                  {tourItem.routeMode === "round_trip" ? "Round trip" : "Open"}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadTour(tourItem)}
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteTour(tourItem.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="h-[70svh] overflow-hidden rounded-xl border border-border">
        <Map
          mapLib={maplibregl}
          initialViewState={{
            longitude: DEFAULT_MAP_CENTER[0],
            latitude: DEFAULT_MAP_CENTER[1],
            zoom: DEFAULT_MAP_ZOOM,
          }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          onClick={onMapClick}
          reuseMaps
        >
          <NavigationControl position="top-right" />

          {waypoints.map((point, index) => (
            <Marker
              key={`${point.lat}-${point.lng}-${index}`}
              longitude={point.lng}
              latitude={point.lat}
            >
              <div className="flex size-6 items-center justify-center rounded-full border border-white bg-orange-500 text-xs font-semibold text-white shadow">
                {index + 1}
              </div>
            </Marker>
          ))}

          {geoJson ? (
            <Source id="route" type="geojson" data={geoJson}>
              <Layer {...routeLineStyle} />
            </Source>
          ) : null}
        </Map>
      </div>
    </div>
  )
}
