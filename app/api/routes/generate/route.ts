import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth"
import { generateRouteSchema } from "@/lib/validation"
import { unauthorized, badRequest } from "@/lib/next-response"
import { getCoordinatesForRoute } from "@/lib/routes"

type OrsResponse = {
  features?: Array<{
    geometry?: {
      type: "LineString"
      coordinates: [number, number][]
    }
    properties?: {
      summary?: {
        distance?: number
        duration?: number
      }
    }
  }>
}

export async function POST(request: Request) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const apiKey = process.env.ORS_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "ORS_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const json = await request.json().catch(() => null)
  const parsed = generateRouteSchema.safeParse(json)

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const routeCoordinates = getCoordinatesForRoute(
    parsed.data.waypoints,
    parsed.data.routeMode
  )

  const orsPayload = {
    coordinates: routeCoordinates.map((point) => [point.lng, point.lat]),
  }

  const orsResponse = await fetch(
    "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
    {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orsPayload),
    }
  )

  if (!orsResponse.ok) {
    const errorMessage = await orsResponse.text()

    return NextResponse.json(
      {
        error: "Route generation failed",
        detail: errorMessage,
      },
      { status: 502 }
    )
  }

  const orsJson = (await orsResponse.json()) as OrsResponse
  const feature = orsJson.features?.[0]
  const geometry = feature?.geometry
  const distance = feature?.properties?.summary?.distance
  const duration = feature?.properties?.summary?.duration

  if (
    !geometry ||
    geometry.type !== "LineString" ||
    !geometry.coordinates ||
    geometry.coordinates.length < 2 ||
    typeof distance !== "number" ||
    typeof duration !== "number"
  ) {
    return NextResponse.json(
      { error: "Route provider returned an invalid response" },
      { status: 502 }
    )
  }

  return NextResponse.json({
    route: {
      provider: "openrouteservice",
      distanceM: distance,
      durationS: duration,
      geometry,
    },
  })
}
