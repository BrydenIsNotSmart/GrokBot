import { db } from "../database";
import { users, guilds } from "../database/schema";
import { eq } from "drizzle-orm";

/**
 * Available xAI models for premium users
 */
export const AVAILABLE_MODELS = [
  {
    id: "grok-4-fast-non-reasoning",
    name: "Grok 4 Fast (Non-Reasoning)",
    description:
      "Fast response model, optimized for speed. 2M context, 4M tpm, 480 rpm.",
    default: true,
  },
  {
    id: "grok-4-fast-reasoning",
    name: "Grok 4 Fast (Reasoning)",
    description:
      "Fast model with reasoning capabilities. 2M context, 4M tpm, 480 rpm.",
    default: false,
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    name: "Grok 4.1 Fast (Non-Reasoning)",
    description:
      "Latest fast model without reasoning. 2M context, 4M tpm, 480 rpm.",
    default: false,
  },
  {
    id: "grok-4-1-fast-reasoning",
    name: "Grok 4.1 Fast (Reasoning)",
    description:
      "Latest fast model with reasoning. 2M context, 4M tpm, 480 rpm.",
    default: false,
  },
  {
    id: "grok-code-fast-1",
    name: "Grok Code Fast",
    description:
      "Specialized for code generation and analysis. 256K context, 2M tpm, 480 rpm",
    default: false,
  },
  {
    id: "grok-4-0709",
    name: "Grok 4 (0709)",
    description:
      "High-quality model with extended capabilities. 256K context, 2M tpm, 480 rpm.",
    default: false,
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    description: "Lightweight model, cost-effective. 131K context, 480 rpm.",
    default: false,
  },
  {
    id: "grok-3",
    name: "Grok 3",
    description: "High-quality reasoning model. 131K context, 600 rpm.",
    default: false,
  },
  {
    id: "grok-2-image-1212",
    name: "Grok 2 Image (1212)",
    description: "AI image generation model. Creates images from text prompts. Premium only.",
    default: false,
  },
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

/**
 * Checks if a model is a reasoning model
 */
export function isReasoningModel(modelId: ModelId): boolean {
  return modelId.includes("reasoning") || 
         modelId === "grok-3" || 
         modelId === "grok-4-0709";
}

/**
 * Checks if a model is an image generation model
 */
export function isImageGenerationModel(modelId: ModelId): boolean {
  return modelId === "grok-2-image-1212";
}

/**
 * Gets the preferred model for a user
 * Premium users can choose their model, others use the default
 */
export async function getUserModel(
  userId: string,
  serverId: string | null,
): Promise<ModelId> {
  // Check if user has premium or server has premium
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const userTier =
    (user?.premiumTier as "none" | "user_premium") ||
    (user?.isPremium ? "user_premium" : "none");

  let hasPremium = userTier === "user_premium";

  // Check server premium
  if (!hasPremium && serverId) {
    const guild = await db.query.guilds.findFirst({
      where: eq(guilds.id, serverId),
    });
    const serverTier =
      (guild?.premiumTier as "none" | "server_premium") || "none";
    hasPremium = serverTier === "server_premium";
  }

  // If user has premium and has a preferred model, use it
  if (hasPremium && user?.preferredModel) {
    const modelExists = AVAILABLE_MODELS.some(
      (m) => m.id === user.preferredModel,
    );
    if (modelExists) {
      return user.preferredModel as ModelId;
    }
  }

  // Default model
  return "grok-4-fast-non-reasoning";
}

/**
 * Sets the preferred model for a premium user
 */
export async function setUserModel(
  userId: string,
  modelId: ModelId,
): Promise<{ success: boolean; error?: string }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const userTier =
    (user.premiumTier as "none" | "user_premium") ||
    (user.isPremium ? "user_premium" : "none");

  if (userTier !== "user_premium") {
    return { success: false, error: "You need premium to change models" };
  }

  const modelExists = AVAILABLE_MODELS.some((m) => m.id === modelId);
  if (!modelExists) {
    return { success: false, error: "Invalid model ID" };
  }

  await db
    .update(users)
    .set({ preferredModel: modelId })
    .where(eq(users.id, userId));

  return { success: true };
}
