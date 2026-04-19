import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const routeModeEnum = pgEnum("route_mode", ["open", "round_trip"])

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [unique("user_email_unique").on(table.email)]
)

export const accounts = pgTable(
  "account",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("account_user_id_idx").on(table.userId),
  ]
)

export const sessions = pgTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
)

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.identifier, table.token] }),
    unique("verification_token_token_unique").on(table.token),
  ]
)

export const tours = pgTable(
  "tour",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    routeMode: routeModeEnum("route_mode").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("tour_user_id_idx").on(table.userId)]
)

export const tourPoints = pgTable(
  "tour_point",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    label: varchar("label", { length: 120 }),
  },
  (table) => [
    unique("tour_point_tour_seq_unique").on(table.tourId, table.seq),
    index("tour_point_tour_id_idx").on(table.tourId),
  ]
)

export const tourRoutes = pgTable(
  "tour_route",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tourId: uuid("tour_id")
      .notNull()
      .references(() => tours.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    distanceM: doublePrecision("distance_m").notNull(),
    durationS: doublePrecision("duration_s").notNull(),
    geometry: jsonb("geometry").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    unique("tour_route_tour_id_unique").on(table.tourId),
    index("tour_route_tour_id_idx").on(table.tourId),
  ]
)

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  tours: many(tours),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const toursRelations = relations(tours, ({ one, many }) => ({
  user: one(users, {
    fields: [tours.userId],
    references: [users.id],
  }),
  points: many(tourPoints),
  route: one(tourRoutes, {
    fields: [tours.id],
    references: [tourRoutes.tourId],
  }),
}))

export const tourPointsRelations = relations(tourPoints, ({ one }) => ({
  tour: one(tours, {
    fields: [tourPoints.tourId],
    references: [tours.id],
  }),
}))

export const tourRoutesRelations = relations(tourRoutes, ({ one }) => ({
  tour: one(tours, {
    fields: [tourRoutes.tourId],
    references: [tours.id],
  }),
}))

export type RouteMode = (typeof routeModeEnum.enumValues)[number]
