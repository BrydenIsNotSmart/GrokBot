CREATE TABLE "user_server_cooldowns" (
	"userId" varchar NOT NULL,
	"serverId" varchar NOT NULL,
	"lastUsed" timestamp NOT NULL,
	CONSTRAINT "user_server_cooldowns_userId_serverId_pk" PRIMARY KEY("userId","serverId")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "isPremium" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "lastPromptDate" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "promptsUsedToday" integer DEFAULT 0;