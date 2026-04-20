import { z } from "zod"

import { MAX_WAYPOINTS } from "@/lib/constants"

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const routeModeSchema = z.enum(["open", "round_trip"])

export const waypointSchema = coordinate.extend({
  label: z.string().trim().max(120).optional(),
})

export const generateRouteSchema = z.object({
  routeMode: routeModeSchema,
  waypoints: z
    .array(coordinate)
    .min(2, "At least 2 points are required")
    .max(MAX_WAYPOINTS, `At most ${MAX_WAYPOINTS} points are allowed`),
})

export const createTourSchema = z.object({
  title: z.string().trim().min(1).max(200),
  routeMode: routeModeSchema,
  waypoints: z
    .array(waypointSchema)
    .min(2, "At least 2 points are required")
    .max(MAX_WAYPOINTS, `At most ${MAX_WAYPOINTS} points are allowed`),
  route: z.object({
    provider: z.literal("openrouteservice"),
    distanceM: z.number().positive(),
    durationS: z.number().positive(),
    ascentM: z.number().nonnegative(),
    descentM: z.number().nonnegative(),
    geometry: z.object({
      type: z.literal("LineString"),
      coordinates: z
        .array(
          z.union([
            z.tuple([z.number(), z.number()]),
            z.tuple([z.number(), z.number(), z.number()]),
          ])
        )
        .min(2),
    }),
  }),
})
