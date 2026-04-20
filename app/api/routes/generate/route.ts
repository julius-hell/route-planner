import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth"
import { generateRouteSchema } from "@/lib/validation"
import { unauthorized, badRequest } from "@/lib/next-response"
import { getCoordinatesForRoute } from "@/lib/routes"

type OrsResponse = {
  features?: Array<{
    geometry?: {
      type: "LineString"
      coordinates: ([number, number] | [number, number, number])[]
    }
    properties?: {
      summary?: {
        distance?: number
        duration?: number
        ascent?: number
        descent?: number
      }
    }
  }>
}

function calculateElevationFromCoordinates(
  coordinates: ([number, number] | [number, number, number])[]
) {
  let ascentM = 0
  let descentM = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    const previousElevation = coordinates[index - 1]?.[2]
    const currentElevation = coordinates[index]?.[2]

    if (
      typeof previousElevation !== "number" ||
      typeof currentElevation !== "number"
    ) {
      continue
    }

    const delta = currentElevation - previousElevation

    if (delta > 0) {
      ascentM += delta
    } else if (delta < 0) {
      descentM += Math.abs(delta)
    }
  }

  return {
    ascentM,
    descentM,
  }
}

function getRoundTripOptions(roundTripTarget: {
  type: "distance" | "duration"
  value: number
}) {
  if (roundTripTarget.type === "distance") {
    return {
      options: {
        round_trip: {
          length: Math.round(roundTripTarget.value),
          points: 3,
          seed: 11,
        },
      },
    }
  }

  const averageCyclingSpeedMetersPerSecond = 5.5

  return {
    options: {
      round_trip: {
        length: Math.round(
          roundTripTarget.value * averageCyclingSpeedMetersPerSecond
        ),
        points: 3,
        seed: 11,
      },
    },
  }
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
    elevation: true,
    ...(parsed.data.routeMode === "round_trip" && parsed.data.roundTripTarget
      ? getRoundTripOptions(parsed.data.roundTripTarget)
      : {}),
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
  const ascent = feature?.properties?.summary?.ascent
  const descent = feature?.properties?.summary?.descent

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

  const fallbackElevation = calculateElevationFromCoordinates(
    geometry.coordinates
  )

  return NextResponse.json({
    route: {
      provider: "openrouteservice",
      distanceM: distance,
      durationS: duration,
      ascentM: typeof ascent === "number" ? ascent : fallbackElevation.ascentM,
      descentM:
        typeof descent === "number" ? descent : fallbackElevation.descentM,
      geometry,
    },
  })
}
