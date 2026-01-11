CREATE TABLE "guilds" (
	"id" varchar PRIMARY KEY NOT NULL,
	"icon" varchar,
	"blacklisted" boolean DEFAULT false,
	"commandsRan" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"commandsRan" integer DEFAULT 0,
	"blacklisted" boolean DEFAULT false
);
