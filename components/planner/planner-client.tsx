"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Feature, FeatureCollection, LineString } from "geojson"
import type { StyleSpecification } from "maplibre-gl"
import maplibregl from "maplibre-gl"
import { useTheme } from "next-themes"
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
  type MapLayerMouseEvent,
} from "react-map-gl/maplibre"

import { Button } from "@/components/ui/button"
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAX_WAYPOINTS,
} from "@/lib/constants"
import { formatDistance, formatDuration, formatElevation } from "@/lib/format"
import type { RouteMode } from "@/lib/db/schema"
import type { GeneratedRoute, SavedTour, Waypoint } from "@/lib/tour"

type PlannerClientProps = {
  initialTours: SavedTour[]
}

type SearchResult = {
  id: string
  displayName: string
  lat: number
  lng: number
}

type MapView = "map" | "satellite"

const satelliteMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Imagery © Esri",
    },
    transportation: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Roads © Esri",
    },
    boundaries: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Boundaries & labels © Esri",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
    },
    {
      id: "satellite-roads",
      type: "raster",
      source: "transportation",
    },
    {
      id: "satellite-boundaries",
      type: "raster",
      source: "boundaries",
    },
  ],
}

const routeLineStyle = {
  id: "route-line",
  type: "line",
  paint: {
    "line-color": "#f97316",
    "line-width": 4,
  },
} as const

const elevationSegmentStyle = {
  id: "route-elevation-segments",
  type: "line",
  paint: {
    "line-width": 4,
    "line-color": [
      "match",
      ["get", "trend"],
      "up",
      "#22c55e",
      "down",
      "#ef4444",
      "#f59e0b",
    ] as ["match", ["get", string], string, string, string, string, string],
  },
} as const

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong"
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function getSegmentDistanceM(
  from: [number, number] | [number, number, number],
  to: [number, number] | [number, number, number]
) {
  const earthRadiusM = 6371000
  const [fromLng, fromLat] = from
  const [toLng, toLat] = to
  const dLat = toRadians(toLat - fromLat)
  const dLng = toRadians(toLng - fromLng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  return 2 * earthRadiusM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildElevationProfile(geometry: GeneratedRoute["geometry"]) {
  const profile: Array<{ distanceM: number; elevationM: number }> = []
  let cumulativeDistanceM = 0

  for (let index = 0; index < geometry.coordinates.length; index += 1) {
    if (index > 0) {
      const previous = geometry.coordinates[index - 1]
      const current = geometry.coordinates[index]
      cumulativeDistanceM += getSegmentDistanceM(previous, current)
    }

    const currentElevation = geometry.coordinates[index]?.[2]

    if (typeof currentElevation === "number") {
      profile.push({
        distanceM: cumulativeDistanceM,
        elevationM: currentElevation,
      })
    }
  }

  return profile
}

function buildElevationSegments(geometry: GeneratedRoute["geometry"]) {
  const features: Feature<LineString>[] = []

  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const previous = geometry.coordinates[index - 1]
    const current = geometry.coordinates[index]

    const previousElevation = previous[2]
    const currentElevation = current[2]

    let trend = "flat"

    if (
      typeof previousElevation === "number" &&
      typeof currentElevation === "number"
    ) {
      const delta = currentElevation - previousElevation

      if (delta > 1) {
        trend = "up"
      } else if (delta < -1) {
        trend = "down"
      }
    }

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [previous[0], previous[1]],
          [current[0], current[1]],
        ],
      },
      properties: { trend },
    })
  }

  return {
    type: "FeatureCollection",
    features,
  } as FeatureCollection<LineString>
}

function getBrowserLanguageCode() {
  if (typeof navigator === "undefined") {
    return "en"
  }

  const browserLanguage = navigator.language?.toLowerCase() ?? "en"
  const [languageCode] = browserLanguage.split("-")
  return languageCode || "en"
}

export function PlannerClient({ initialTours }: PlannerClientProps) {
  const { resolvedTheme } = useTheme()
  const mapRef = useRef<MapRef | null>(null)
  const [tours, setTours] = useState(initialTours)
  const [routeMode, setRouteMode] = useState<RouteMode>("open")
  const [title, setTitle] = useState("")
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [route, setRoute] = useState<GeneratedRoute | null>(null)
  const [showElevationOverlay, setShowElevationOverlay] = useState(false)
  const [mapView, setMapView] = useState<MapView>("map")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapLanguage, setMapLanguage] = useState("en")

  const mapStyle =
    mapView === "satellite"
      ? satelliteMapStyle
      : resolvedTheme === "dark"
        ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"

  const applyMapLanguage = useCallback(() => {
    const map = mapRef.current?.getMap()

    if (!map) {
      return
    }

    const style = map.getStyle()

    if (!style?.layers) {
      return
    }

    const textFieldExpression = [
      "coalesce",
      ["get", `name:${mapLanguage}`],
      ["get", `name_${mapLanguage}`],
      ["get", "name:latin"],
      ["get", "name_en"],
      ["get", "name"],
    ]

    for (const layer of style.layers) {
      if (layer.type !== "symbol") {
        continue
      }

      if (!("layout" in layer) || !layer.layout?.["text-field"]) {
        continue
      }

      try {
        map.setLayoutProperty(layer.id, "text-field", textFieldExpression)
      } catch {
        continue
      }
    }
  }, [mapLanguage])

  const handleMapLoad = useCallback(() => {
    setMapLanguage(getBrowserLanguageCode())
  }, [])

  const handleMapStyleData = useCallback(() => {
    applyMapLanguage()
  }, [applyMapLanguage])

  useEffect(() => {
    applyMapLanguage()
  }, [applyMapLanguage])

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

  const elevationSegmentsGeoJson = useMemo(() => {
    if (!route) {
      return null
    }

    return buildElevationSegments(route.geometry)
  }, [route])

  const elevationChart = useMemo(() => {
    if (!route) {
      return null
    }

    const profile = buildElevationProfile(route.geometry)

    if (profile.length < 2) {
      return null
    }

    const minElevationM = Math.min(...profile.map((point) => point.elevationM))
    const maxElevationM = Math.max(...profile.map((point) => point.elevationM))
    const elevationRangeM = Math.max(maxElevationM - minElevationM, 1)
    const totalDistanceM = profile[profile.length - 1]?.distanceM ?? 0
    const chartHeight = 40

    const points = profile
      .map((point) => {
        const x =
          totalDistanceM > 0 ? (point.distanceM / totalDistanceM) * 100 : 0
        const y =
          chartHeight -
          ((point.elevationM - minElevationM) / elevationRangeM) * chartHeight
        return `${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(" ")

    const firstX =
      totalDistanceM > 0 ? (profile[0].distanceM / totalDistanceM) * 100 : 0
    const lastX =
      totalDistanceM > 0
        ? (profile[profile.length - 1].distanceM / totalDistanceM) * 100
        : 100

    const areaPath = `M ${firstX.toFixed(2)} ${chartHeight.toFixed(2)} L ${points.replace(/ /g, " L ")} L ${lastX.toFixed(2)} ${chartHeight.toFixed(2)} Z`

    return {
      points,
      areaPath,
      minElevationM,
      maxElevationM,
      totalDistanceM,
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

  async function searchAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setError(null)
    setIsSearching(true)

    try {
      const response = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(searchQuery.trim())}`
      )

      const data = (await response.json().catch(() => null)) as {
        results?: SearchResult[]
        error?: string
      } | null

      if (!response.ok || !data?.results) {
        throw new Error(data?.error ?? "Could not search address")
      }

      setSearchResults(data.results)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSearching(false)
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

  function focusSearchResult(result: SearchResult) {
    mapRef.current?.flyTo({
      center: [result.lng, result.lat],
      zoom: 13,
      duration: 900,
    })
  }

  function addSearchResultAsWaypoint(result: SearchResult) {
    if (waypoints.length >= MAX_WAYPOINTS) {
      setError(`You can add up to ${MAX_WAYPOINTS} points`)
      return
    }

    focusSearchResult(result)
    setError(null)
    setRoute(null)
    setWaypoints((currentPoints) => [
      ...currentPoints,
      {
        lat: result.lat,
        lng: result.lng,
      },
    ])
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
            Address search
          </p>
          <form onSubmit={searchAddress} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search city or street"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
              minLength={2}
            />
            <Button type="submit" variant="outline" disabled={isSearching}>
              {isSearching ? "..." : "Find"}
            </Button>
          </form>

          {searchResults.length > 0 ? (
            <div className="max-h-36 space-y-2 overflow-auto pr-1">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="rounded-md border border-border p-2 text-xs"
                >
                  <p className="line-clamp-2 text-muted-foreground">
                    {result.displayName}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => focusSearchResult(result)}
                    >
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => addSearchResultAsWaypoint(result)}
                    >
                      Add Point
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

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
            <Button
              variant={showElevationOverlay ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setShowElevationOverlay((currentValue) => !currentValue)
              }
            >
              Elevation
            </Button>
            <Button
              variant={mapView === "satellite" ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setMapView((currentView) =>
                  currentView === "map" ? "satellite" : "map"
                )
              }
            >
              {mapView === "satellite" ? "Map" : "Satellite"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {routeMode === "round_trip"
              ? "Round trip auto-closes back to the first point"
              : "Open routes end at the last selected point"}
          </p>
          {showElevationOverlay ? (
            <p className="text-xs text-muted-foreground">
              Map colors: green uphill, red downhill, amber mostly flat.
            </p>
          ) : null}
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
            <p className="text-muted-foreground">
              Elevation: +{formatElevation(route.ascentM)} / -
              {formatElevation(route.descentM)}
            </p>
            {elevationChart ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Elevation profile
                </p>
                <svg
                  viewBox="0 0 100 40"
                  className="h-24 w-full rounded border border-border bg-muted/20"
                  preserveAspectRatio="none"
                >
                  <path
                    d={elevationChart.areaPath}
                    fill="currentColor"
                    className="text-orange-500/15"
                  />
                  <polyline
                    points={elevationChart.points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-orange-500"
                  />
                </svg>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 km</span>
                  <span>{formatDistance(elevationChart.totalDistanceM)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Min {formatElevation(elevationChart.minElevationM)}
                  </span>
                  <span>
                    Max {formatElevation(elevationChart.maxElevationM)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No elevation profile data for this route.
              </p>
            )}
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
                {tourItem.route ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDistance(tourItem.route.distanceM)} ·{" "}
                      {formatDuration(tourItem.route.durationS)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      +{formatElevation(tourItem.route.ascentM)} / -
                      {formatElevation(tourItem.route.descentM)}
                    </p>
                  </>
                ) : null}
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
                  <Button size="sm" variant="secondary" asChild>
                    <a href={`/api/tours/${tourItem.id}/gpx`} download>
                      GPX
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="h-[70svh] overflow-hidden rounded-xl border border-border">
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={{
            longitude: DEFAULT_MAP_CENTER[0],
            latitude: DEFAULT_MAP_CENTER[1],
            zoom: DEFAULT_MAP_ZOOM,
          }}
          mapStyle={mapStyle}
          onClick={onMapClick}
          onLoad={handleMapLoad}
          onStyleData={handleMapStyleData}
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

          {geoJson && !showElevationOverlay ? (
            <Source id="route" type="geojson" data={geoJson}>
              <Layer {...routeLineStyle} />
            </Source>
          ) : null}

          {elevationSegmentsGeoJson && showElevationOverlay ? (
            <Source
              id="route-elevation"
              type="geojson"
              data={elevationSegmentsGeoJson}
            >
              <Layer {...elevationSegmentStyle} />
            </Source>
          ) : null}
        </Map>
      </div>
    </div>
  )
}
