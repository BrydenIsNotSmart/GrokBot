ALTER TABLE "guilds" ADD COLUMN "premiumTier" varchar DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "lastPromptDate" varchar;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "promptsUsedToday" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "premiumTier" varchar DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferredModel" varchar DEFAULT 'grok-4-fast-non-reasoning';