-- Add web search mode column to guilds table
ALTER TABLE "guilds" ADD COLUMN "webSearchMode" varchar DEFAULT 'disabled';
