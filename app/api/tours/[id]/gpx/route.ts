import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { buildTourGpx, toSafeFileName } from "@/lib/gpx"
import { badRequest, notFound, unauthorized } from "@/lib/next-response"
import { serializeTour } from "@/lib/tour-serializer"

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteParams) {
  const session = await getServerAuthSession()

  if (!session?.user?.id) {
    return unauthorized()
  }

  const { id } = await context.params

  const tour = await db.query.tours.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, id), eq(table.userId, session.user.id)),
    with: {
      points: {
        orderBy: (table, { asc }) => [asc(table.seq)],
      },
      route: true,
    },
  })

  if (!tour) {
    return notFound("Tour not found")
  }

  const serializedTour = serializeTour(tour)

  if (!serializedTour.route) {
    return badRequest("Tour has no generated route")
  }

  const gpx = buildTourGpx(serializedTour)
  const safeTitle = toSafeFileName(serializedTour.title) || "bike-tour"
  const fileName = `${safeTitle}.gpx`

  return new NextResponse(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
