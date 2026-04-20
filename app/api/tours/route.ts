import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { tourPoints, tourRoutes, tours } from "@/lib/db/schema"
import { unauthorized, badRequest } from "@/lib/next-response"
import { serializeTour } from "@/lib/tour-serializer"
import { createTourSchema } from "@/lib/validation"

export async function GET() {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const rows = await db.query.tours.findMany({
    where: (table, { eq: equals }) => equals(table.userId, session.user.id),
    orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
    with: {
      points: {
        orderBy: (table, { asc: ascending }) => [ascending(table.seq)],
      },
      route: true,
    },
  })

  return NextResponse.json({ tours: rows.map(serializeTour) })
}

export async function POST(request: Request) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const json = await request.json().catch(() => null)
  const parsed = createTourSchema.safeParse(json)

  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const insertedTour = await db
    .insert(tours)
    .values({
      userId: session.user.id,
      title: parsed.data.title,
      routeMode: parsed.data.routeMode,
    })
    .returning({ id: tours.id })

  const tourId = insertedTour[0]?.id

  if (!tourId) {
    return NextResponse.json(
      { error: "Failed to create tour" },
      { status: 500 }
    )
  }

  await db.insert(tourPoints).values(
    parsed.data.waypoints.map((point, index) => ({
      tourId,
      seq: index,
      lat: point.lat,
      lng: point.lng,
      label: point.label,
    }))
  )

  await db.insert(tourRoutes).values({
    tourId,
    provider: parsed.data.route.provider,
    distanceM: parsed.data.route.distanceM,
    durationS: parsed.data.route.durationS,
    ascentM: parsed.data.route.ascentM,
    descentM: parsed.data.route.descentM,
    geometry: parsed.data.route.geometry,
  })

  const savedTour = await db.query.tours.findFirst({
    where: (table, { eq: equals }) => equals(table.id, tourId),
    with: {
      points: {
        orderBy: (table, { asc: ascending }) => [ascending(table.seq)],
      },
      route: true,
    },
  })

  if (!savedTour) {
    return NextResponse.json(
      { error: "Tour not found after creation" },
      { status: 500 }
    )
  }

  return NextResponse.json({ tour: serializeTour(savedTour) }, { status: 201 })
}
