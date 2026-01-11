import { db } from "../database";
import { users, userServerCooldowns, guilds } from "../database/schema";
import { eq, and } from "drizzle-orm";
import { COOLDOWN_MS } from "../config";

const FREE_DAILY_PROMPT_LIMIT = 10;
const USER_PREMIUM_DAILY_LIMIT = 100;
const SERVER_PREMIUM_DAILY_LIMIT = 500;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remainingCooldown?: number; // in seconds
  remainingPrompts?: number;
  premiumTier?: "user_premium" | "server_premium" | "none";
}

/**
 * Checks if a user can use a prompt based on cooldown and daily limits
 * @param userId - Discord user ID
 * @param serverId - Discord server/guild ID
 * @returns RateLimitResult with allowed status and details
 */
export async function checkRateLimit(
  userId: string,
  serverId: string | null,
): Promise<RateLimitResult> {
  // Get or create user record
  let user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    await db.insert(users).values({
      id: userId,
      promptsUsedToday: 0,
      isPremium: false,
      premiumTier: "none",
    });
    user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }

  if (!user) {
    return {
      allowed: false,
      reason: "Failed to create user record. Please try again.",
    };
  }

  // Check if user is blacklisted
  if (user.blacklisted) {
    return {
      allowed: false,
      reason: "You are blacklisted from using this bot.",
    };
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  
  // Determine premium tier (server premium takes precedence)
  let premiumTier: "user_premium" | "server_premium" | "none" = "none";
  let dailyLimit = FREE_DAILY_PROMPT_LIMIT;
  let promptsUsed = user.promptsUsedToday ?? 0;
  let lastPromptDate = user.lastPromptDate
    ? (typeof user.lastPromptDate === "string"
        ? user.lastPromptDate
        : new Date(user.lastPromptDate).toISOString().split("T")[0])
    : null;

  // Check for server premium (takes precedence)
  if (serverId) {
    let guild = await db.query.guilds.findFirst({
      where: eq(guilds.id, serverId),
    });

    if (!guild) {
      await db.insert(guilds).values({
        id: serverId,
        premiumTier: "none",
        promptsUsedToday: 0,
      });
      guild = await db.query.guilds.findFirst({
        where: eq(guilds.id, serverId),
      });
    }

    if (!guild) {
      return {
        allowed: false,
        reason: "Failed to create server record. Please try again.",
      };
    }

    // Check if server is blacklisted
    if (guild.blacklisted) {
      return {
        allowed: false,
        reason: "This server is blacklisted from using this bot.",
      };
    }

    // Check server premium tier
    const serverTier = (guild.premiumTier as "none" | "server_premium") || "none";
    if (serverTier === "server_premium") {
      premiumTier = "server_premium";
      dailyLimit = SERVER_PREMIUM_DAILY_LIMIT;
      
      // Use server's prompt tracking
      const serverLastPromptDate = guild.lastPromptDate
        ? (typeof guild.lastPromptDate === "string"
            ? guild.lastPromptDate
            : new Date(guild.lastPromptDate).toISOString().split("T")[0])
        : null;

      // Reset server daily count if it's a new day
      if (serverLastPromptDate !== today) {
        await db
          .update(guilds)
          .set({
            lastPromptDate: today,
            promptsUsedToday: 0,
          })
          .where(eq(guilds.id, serverId));
        promptsUsed = 0;
      } else {
        promptsUsed = guild.promptsUsedToday ?? 0;
      }

      // Check if server has exceeded daily limit
      if (promptsUsed >= SERVER_PREMIUM_DAILY_LIMIT) {
        return {
          allowed: false,
          reason: `This server has reached its daily limit of ${SERVER_PREMIUM_DAILY_LIMIT} prompts. Please try again tomorrow!`,
          remainingPrompts: 0,
          premiumTier: "server_premium",
        };
      }
    }
  }

  // Check user premium if server premium is not active
  if (premiumTier === "none") {
    const userTier = (user.premiumTier as "none" | "user_premium") || 
                     (user.isPremium ? "user_premium" : "none");
    
    if (userTier === "user_premium") {
      premiumTier = "user_premium";
      dailyLimit = USER_PREMIUM_DAILY_LIMIT;
      
      // Reset user daily count if it's a new day
      if (lastPromptDate !== today) {
        await db
          .update(users)
          .set({
            lastPromptDate: today,
            promptsUsedToday: 0,
          })
          .where(eq(users.id, userId));
        promptsUsed = 0;
        user.promptsUsedToday = 0;
        user.lastPromptDate = today as any;
      } else {
        promptsUsed = user.promptsUsedToday ?? 0;
      }

      // Check if user has exceeded daily limit
      if (promptsUsed >= USER_PREMIUM_DAILY_LIMIT) {
        return {
          allowed: false,
          reason: `You have reached your daily limit of ${USER_PREMIUM_DAILY_LIMIT} prompts. Please try again tomorrow!`,
          remainingPrompts: 0,
          premiumTier: "user_premium",
        };
      }
    } else {
      // Free tier - use user's prompt tracking
      // Reset user daily count if it's a new day
      if (lastPromptDate !== today) {
        await db
          .update(users)
          .set({
            lastPromptDate: today,
            promptsUsedToday: 0,
          })
          .where(eq(users.id, userId));
        promptsUsed = 0;
        user.promptsUsedToday = 0;
        user.lastPromptDate = today as any;
      } else {
        promptsUsed = user.promptsUsedToday ?? 0;
      }

      // Check if user has exceeded daily limit
      if (promptsUsed >= FREE_DAILY_PROMPT_LIMIT) {
        return {
          allowed: false,
          reason: `You have reached your daily limit of ${FREE_DAILY_PROMPT_LIMIT} prompts. Please try again tomorrow!`,
          remainingPrompts: 0,
          premiumTier: "none",
        };
      }
    }
  }

  // Check per-server cooldown (if serverId is provided)
  if (serverId) {
    const cooldownRecord = await db.query.userServerCooldowns.findFirst({
      where: and(
        eq(userServerCooldowns.userId, userId),
        eq(userServerCooldowns.serverId, serverId),
      ),
    });

    if (cooldownRecord) {
      const lastUsed = new Date(cooldownRecord.lastUsed).getTime();
      const elapsed = Date.now() - lastUsed;

      if (elapsed < COOLDOWN_MS) {
        const remainingMs = COOLDOWN_MS - elapsed;
        const remainingSec = (remainingMs / 1000).toFixed(1);
        return {
          allowed: false,
          reason: `You are on cooldown! Please try again in ${remainingSec}s.`,
          remainingCooldown: Math.ceil(remainingMs / 1000),
        };
      }
    }
  }

  // All checks passed
  return {
    allowed: true,
    remainingPrompts: dailyLimit - promptsUsed - 1,
    premiumTier,
  };
}

/**
 * Records a prompt usage in the database
 * @param userId - Discord user ID
 * @param serverId - Discord server/guild ID
 */
export async function recordPromptUsage(
  userId: string,
  serverId: string | null,
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Determine which premium tier is active
  let useServerTracking = false;

  if (serverId) {
    const guild = await db.query.guilds.findFirst({
      where: eq(guilds.id, serverId),
    });

    if (guild && (guild.premiumTier === "server_premium")) {
      useServerTracking = true;
      
      // Update server's prompt count
      const serverLastPromptDate = guild.lastPromptDate
        ? (typeof guild.lastPromptDate === "string"
            ? guild.lastPromptDate
            : new Date(guild.lastPromptDate).toISOString().split("T")[0])
        : null;

      if (serverLastPromptDate !== today) {
        await db
          .update(guilds)
          .set({
            lastPromptDate: today,
            promptsUsedToday: 1,
          })
          .where(eq(guilds.id, serverId));
      } else {
        await db
          .update(guilds)
          .set({
            promptsUsedToday: (guild.promptsUsedToday ?? 0) + 1,
          })
          .where(eq(guilds.id, serverId));
      }
    }
  }

  // Update user's daily prompt count (always track for user premium or free tier)
  if (!useServerTracking) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (user) {
      const userLastPromptDate = user.lastPromptDate
        ? (typeof user.lastPromptDate === "string"
            ? user.lastPromptDate
            : new Date(user.lastPromptDate).toISOString().split("T")[0])
        : null;
      
      // Reset if new day
      if (userLastPromptDate !== today) {
        await db
          .update(users)
          .set({
            lastPromptDate: today,
            promptsUsedToday: 1,
          })
          .where(eq(users.id, userId));
      } else {
        // Increment count
        await db
          .update(users)
          .set({
            promptsUsedToday: (user.promptsUsedToday ?? 0) + 1,
          })
          .where(eq(users.id, userId));
      }
    } else {
      await db.insert(users).values({
        id: userId,
        lastPromptDate: today,
        promptsUsedToday: 1,
        premiumTier: "none",
      });
    }
  }

  // Update per-server cooldown
  if (serverId) {
    const cooldownRecord = await db.query.userServerCooldowns.findFirst({
      where: and(
        eq(userServerCooldowns.userId, userId),
        eq(userServerCooldowns.serverId, serverId),
      ),
    });

    if (cooldownRecord) {
      await db
        .update(userServerCooldowns)
        .set({
          lastUsed: new Date(),
        })
        .where(
          and(
            eq(userServerCooldowns.userId, userId),
            eq(userServerCooldowns.serverId, serverId),
          ),
        );
    } else {
      await db.insert(userServerCooldowns).values({
        userId,
        serverId,
        lastUsed: new Date(),
      });
    }
  }
}
