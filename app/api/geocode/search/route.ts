import { NextResponse } from "next/server"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth"
import { badRequest, unauthorized } from "@/lib/next-response"

const querySchema = z.object({
  q: z.string().trim().min(2).max(200),
})

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

export async function GET(request: Request) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? "" })

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid query")
  }

  const params = new URLSearchParams({
    q: parsed.data.q,
    format: "jsonv2",
    limit: "6",
    addressdetails: "0",
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": "route-planner/0.0.1 (bike tour planner)",
        Accept: "application/json",
      },
    }
  )

  if (!response.ok) {
    return NextResponse.json(
      { error: "Address search failed" },
      { status: 502 }
    )
  }

  const json = (await response.json()) as NominatimResult[]

  return NextResponse.json({
    results: json
      .map((entry) => ({
        id: String(entry.place_id),
        displayName: entry.display_name,
        lat: Number(entry.lat),
        lng: Number(entry.lon),
      }))
      .filter(
        (entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng)
      ),
  })
}
