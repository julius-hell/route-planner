ALTER TABLE "tour_route" ADD COLUMN "ascent_m" double precision NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tour_route" ADD COLUMN "descent_m" double precision NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tour_route" ALTER COLUMN "ascent_m" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tour_route" ALTER COLUMN "descent_m" DROP DEFAULT;
