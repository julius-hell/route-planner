import { z } from "zod"

import { MAX_WAYPOINTS } from "@/lib/constants"

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const roundTripTargetSchema = z.object({
  type: z.enum(["distance", "duration"]),
  value: z.number().positive(),
})

export const routeModeSchema = z.enum(["open", "round_trip"])

export const waypointSchema = coordinate.extend({
  label: z.string().trim().max(120).optional(),
})

export const generateRouteSchema = z
  .object({
    routeMode: routeModeSchema,
    waypoints: z
      .array(coordinate)
      .max(MAX_WAYPOINTS, `At most ${MAX_WAYPOINTS} points are allowed`),
    roundTripTarget: roundTripTargetSchema.optional(),
  })
  .superRefine((data, context) => {
    if (data.routeMode === "open") {
      if (data.waypoints.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["waypoints"],
          message: "At least 2 points are required",
        })
      }

      if (data.roundTripTarget) {
        context.addIssue({
          code: "custom",
          path: ["roundTripTarget"],
          message: "Round trip target is only valid for round-trip mode",
        })
      }

      return
    }

    if (data.waypoints.length < 1) {
      context.addIssue({
        code: "custom",
        path: ["waypoints"],
        message: "At least 1 point is required for round-trip mode",
      })
    }

    if (!data.roundTripTarget && data.waypoints.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["waypoints"],
        message: "At least 2 points are required unless an auto target is set",
      })
    }

    if (data.roundTripTarget && data.waypoints.length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["waypoints"],
        message: "Auto round-trip generation requires exactly 1 start point",
      })
    }
  })

export const createTourSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    routeMode: routeModeSchema,
    waypoints: z
      .array(waypointSchema)
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
  .superRefine((data, context) => {
    if (data.routeMode === "open" && data.waypoints.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["waypoints"],
        message: "At least 2 points are required",
      })
    }

    if (data.routeMode === "round_trip" && data.waypoints.length < 1) {
      context.addIssue({
        code: "custom",
        path: ["waypoints"],
        message: "At least 1 point is required for round-trip mode",
      })
    }
  })
