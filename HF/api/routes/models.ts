/**
 * OpenAI-Compatible Models API
 *
 * GET /v1/models
 *
 * Lists available DANIELS AI "models" in standard OpenAI format.
 * Any OpenAI SDK's client.models.list() will work.
 */

import { Router } from "express";
import { ULTRAPLINIAN_MODELS } from "../lib/ultraplinian";

export const modelsRoutes = Router();

const CREATED = 1700000000; // static timestamp

interface ModelEntry {
  id: string;
  description: string;
  tier?: string;
  model_count?: number;
}

const DANIELSAI_MODELS: ModelEntry[] = [
  {
    id: "ultraplinian",
    description:
      "ULTRAPLINIAN: Race 12 models in parallel, return the best (fast tier). Alias for ultraplinian-fast.",
    tier: "fast",
    model_count: ULTRAPLINIAN_MODELS.fast.length,
  },
  {
    id: "ultraplinian-fast",
    description: `ULTRAPLINIAN fast tier: Race ${ULTRAPLINIAN_MODELS.fast.length} models in parallel.`,
    tier: "fast",
    model_count: ULTRAPLINIAN_MODELS.fast.length,
  },
  {
    id: "ultraplinian-standard",
    description: `ULTRAPLINIAN standard tier: Race ${ULTRAPLINIAN_MODELS.fast.length + ULTRAPLINIAN_MODELS.standard.length} models in parallel.`,
    tier: "standard",
    model_count:
      ULTRAPLINIAN_MODELS.fast.length + ULTRAPLINIAN_MODELS.standard.length,
  },
  {
    id: "ultraplinian-full",
    description: `ULTRAPLINIAN full tier: Race all ${ULTRAPLINIAN_MODELS.fast.length + ULTRAPLINIAN_MODELS.standard.length + ULTRAPLINIAN_MODELS.ultra.length} models in parallel.`,
    tier: "full",
    model_count:
      ULTRAPLINIAN_MODELS.fast.length +
      ULTRAPLINIAN_MODELS.standard.length +
      ULTRAPLINIAN_MODELS.ultra.length,
  },
];

modelsRoutes.get("/", (_req, res) => {
  const data = DANIELSAI_MODELS.map((m) => ({
    id: m.id,
    object: "model" as const,
    created: CREATED,
    owned_by: "danielsai",
    // Extra metadata (OpenAI SDK ignores these)
    description: m.description,
    tier: m.tier,
    model_count: m.model_count,
  }));

  res.json({ object: "list", data });
});

/**
 * GET /v1/models/:model_id
 * Retrieve a single model's info (OpenAI-compatible)
 */
modelsRoutes.get("/:model_id", (req, res) => {
  const entry = DANIELSAI_MODELS.find((m) => m.id === req.params.model_id);

  if (!entry) {
    // If it's not a DANIELS AI model, it might be an OpenRouter model — that's fine
    res.json({
      id: req.params.model_id,
      object: "model",
      created: CREATED,
      owned_by: "openrouter",
      description:
        "Passthrough to OpenRouter with full DANIELS AI pipeline (AutoTune + Parseltongue + STM).",
    });
    return;
  }

  res.json({
    id: entry.id,
    object: "model",
    created: CREATED,
    owned_by: "danielsai",
    description: entry.description,
    tier: entry.tier,
    model_count: entry.model_count,
  });
});
