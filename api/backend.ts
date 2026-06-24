/**
 * DANIELS AI Research Preview API
 *
 * Exposes the core engines (AutoTune, Parseltongue, STM, Feedback Loop)
 * and the flagship ULTRAPLINIAN multi-model racing mode as a REST API.
 *
 * Includes opt-in dataset collection for building an open source research dataset.
 * Enterprise paywall: tier-based access control (free/pro/enterprise).
 *
 * Designed for deployment on Hugging Face Spaces (Docker) or any container host.
 */

import Router from "express";
import { rateLimit } from "./middleware/rateLimit";
import { apiKeyAuth } from "./middleware/auth";
import { tierGate } from "./middleware/tierGate";
import { autotuneRoutes } from "./routes/autotune";
import { parseltongueRoutes } from "./routes/parseltongue";
import { transformRoutes } from "./routes/transform";
import { chatRoutes } from "./routes/chat";
import { feedbackRoutes } from "./routes/feedback";
import { ultraplinianRoutes } from "./routes/ultraplinian";
import { consortiumRoutes } from "./routes/consortium";
import { datasetRoutes } from "./routes/dataset";
import { metadataRoutes } from "./routes/metadata";
import { researchRoutes } from "./routes/research";
import { TIER_CONFIGS } from "./lib/tiers";
import { ULTRAPLINIAN_MODELS } from "./lib/ultraplinian";
import { getPublisherStatus } from "./lib/hf-publisher";

import type { TierConfig } from "./lib/tiers";

const router = Router();

// ── Health / Info (no auth required) ──────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

router.get("/info", (_req, res) => {
  res.json({
    name: "DANIELS AI Research Preview API",
    version: "0.4.0",
    description:
      "ULTRAPLINIAN multi-model racing with Liquid Response live upgrades, context-adaptive parameter tuning, text transformation, obfuscation, opt-in open dataset collection, and full Research API for querying the published corpus on HuggingFace.",
    license: "AGPL-3.0",
    flagship: "POST /v1/ultraplinian/completions",
    consortium: "POST /v1/consortium/completions",
    defaults: {
      stream: true,
      liquid_min_delta: 8,
      note: "Streaming (Liquid Response) is ON by default. The first good response is served immediately via SSE, then auto-upgraded when a better model beats the current leader by liquid_min_delta score points.",
    },
    tiers: {
      free: {
        label: "Free",
        limits: TIER_CONFIGS.free.rateLimit,
        ultraplinian: TIER_CONFIGS.free.ultraplinianTiers,
        research: TIER_CONFIGS.free.researchAccess,
      },
      pro: {
        label: "Pro",
        limits: TIER_CONFIGS.pro.rateLimit,
        ultraplinian: TIER_CONFIGS.pro.ultraplinianTiers,
        research: TIER_CONFIGS.pro.researchAccess,
      },
      enterprise: {
        label: "Enterprise",
        limits: TIER_CONFIGS.enterprise.rateLimit,
        ultraplinian: TIER_CONFIGS.enterprise.ultraplinianTiers,
        research: TIER_CONFIGS.enterprise.researchAccess,
      },
    },
    endpoints: {
      "GET  /v1/tier": "Check your current tier, limits, and feature access",
      "POST /v1/ultraplinian/completions":
        "ULTRAPLINIAN: Race N models in parallel with Liquid Response (stream=true default). First good response served immediately, auto-upgrades live.",
      "POST /v1/consortium/completions":
        "CONSORTIUM: Collect ALL model responses, orchestrator synthesizes ground truth from collective intelligence.",
      "POST /v1/chat/completions":
        'Single-model pipeline with DANIELS AI + AutoTune + Parseltongue + STM. Also supports model="ultraplinian/*" and model="consortium/*" virtual models.',
      "POST /v1/autotune/analyze":
        "Analyze message context and compute optimal LLM parameters",
      "POST /v1/parseltongue/encode": "Obfuscate trigger words in text",
      "POST /v1/parseltongue/detect": "Detect trigger words in text",
      "POST /v1/transform": "Apply semantic transformation modules to text",
      "POST /v1/feedback": "Submit quality feedback for the EMA learning loop",
      "GET  /v1/dataset/stats": "Dataset collection statistics (Pro+)",
      "GET  /v1/dataset/export": "Export the open research dataset (Pro+)",
      "GET  /v1/metadata/stats":
        "ZDR usage analytics (models, latency, pipeline stats — no content)",
      "GET  /v1/metadata/events": "Raw metadata event log (Enterprise only)",
      "GET  /v1/research/info": "Research dataset schema, repo info (Pro+)",
      "GET  /v1/research/stats":
        "Aggregate stats across all published HF batches (Pro+)",
      "GET  /v1/research/batches": "List all published batch files (Pro+)",
      "GET  /v1/research/batch/*": "Read a specific batch file (Pro+)",
      "GET  /v1/research/query":
        "Query the full corpus with filters (Enterprise)",
      "POST /v1/research/flush":
        "Force-flush in-memory buffers to HuggingFace (Enterprise)",
      "GET  /v1/research/download":
        "Download full corpus as streaming JSONL (Enterprise)",
      "GET  /v1/research/combined-stats":
        "Combined in-memory + published stats (Pro+)",
    },
    authentication: {
      openrouter_key: process.env.OPENROUTER_API_KEY
        ? "Server-provided (callers do NOT need their own OpenRouter key)"
        : "Caller must provide openrouter_api_key in request body",
      api_key:
        "Send Authorization: Bearer <your-api-key> (if server has DANIELSAI_API_KEY set)",
      tier_assignment:
        'Set DANIELSAI_TIER_KEYS="enterprise:key1,pro:key2" to assign tiers to keys',
    },
    dataset: {
      note: "Opt-in per request via contribute_to_dataset: true. No PII stored. Exportable as JSONL for HuggingFace Datasets.",
    },
    auto_publish: getPublisherStatus(),
    source: "https://github.com/danielstputra/Daniels-AI-Tools",
  });
});

// ── Models Endpoint (OpenAI-compatible) ───────────────────────────────
// Enterprise users need this for SDK model discovery

router.get("/models", (_req, res) => {
  const allModels = [
    ...ULTRAPLINIAN_MODELS.fast,
    ...ULTRAPLINIAN_MODELS.standard,
    ...ULTRAPLINIAN_MODELS.smart,
    ...ULTRAPLINIAN_MODELS.power,
    ...ULTRAPLINIAN_MODELS.ultra,
  ];

  const created = Math.floor(Date.now() / 1000);

  // Virtual ULTRAPLINIAN models — race N models, return the best
  const virtualModels = [
    { id: "ultraplinian/fast", owned_by: "danielsai" },
    { id: "ultraplinian/standard", owned_by: "danielsai" },
    { id: "ultraplinian/smart", owned_by: "danielsai" },
    { id: "ultraplinian/power", owned_by: "danielsai" },
    { id: "ultraplinian/ultra", owned_by: "danielsai" },
    // CONSORTIUM — hive-mind synthesis from all models
    { id: "consortium/fast", owned_by: "danielsai" },
    { id: "consortium/standard", owned_by: "danielsai" },
    { id: "consortium/smart", owned_by: "danielsai" },
    { id: "consortium/power", owned_by: "danielsai" },
    { id: "consortium/ultra", owned_by: "danielsai" },
  ];

  res.json({
    object: "list",
    data: [
      // Virtual ULTRAPLINIAN models first
      ...virtualModels.map((m) => ({
        id: m.id,
        object: "model" as const,
        created,
        owned_by: m.owned_by,
      })),
      // Individual models
      ...allModels.map((id) => ({
        id,
        object: "model" as const,
        created,
        owned_by: id.split("/")[0] || "unknown",
      })),
    ],
  });
});

// ── Tier Info Endpoint (authenticated) ────────────────────────────────
router.get("/tier", apiKeyAuth, (req, res) => {
  const tier = req.tier || "free";
  const config: TierConfig = req.tierConfig as TierConfig;
  res.json({
    tier: config.name,
    label: config.label,
    limits: config.rateLimit,
    features: {
      ultraplinian_tiers: config.ultraplinianTiers,
      max_race_models: config.maxRaceModels,
      research_access: config.researchAccess,
      dataset_export_formats: config.datasetExportFormats,
      can_flush: config.canFlush,
      can_access_metadata_events: config.canAccessMetadataEvents,
      can_download_corpus: config.canDownloadCorpus,
    },
    upgrade:
      tier !== "enterprise"
        ? "Contact sales or set DANIELSAI_TIER_KEYS to upgrade your API key tier."
        : undefined,
  });
});

// ── Core routes (all tiers) ───────────────────────────────────────────
router.use("/ultraplinian", apiKeyAuth, rateLimit, ultraplinianRoutes);
router.use("/consortium", apiKeyAuth, rateLimit, consortiumRoutes);
router.use("/chat", apiKeyAuth, rateLimit, chatRoutes);
router.use("/autotune", apiKeyAuth, rateLimit, autotuneRoutes);
router.use("/parseltongue", apiKeyAuth, rateLimit, parseltongueRoutes);
router.use("/transform", apiKeyAuth, rateLimit, transformRoutes);
router.use("/feedback", apiKeyAuth, rateLimit, feedbackRoutes);

// ── Gated routes ──────────────────────────────────────────────────────
// Dataset: Pro+ for export, stats accessible by all
router.use(
  "/dataset",
  apiKeyAuth,
  rateLimit,
  tierGate("dataset:export"),
  datasetRoutes,
);

// Metadata: stats open to all auth'd users, events gated to Enterprise
router.use("/metadata", apiKeyAuth, metadataRoutes); // individual route-level gating in metadata routes

// Research: Pro+ for read access, Enterprise for full access
router.use(
  "/research",
  apiKeyAuth,
  rateLimit,
  tierGate("research:read"),
  researchRoutes,
);

// ── 404 ───────────────────────────────────────────────────────────────
router.use((_req, res) => {
  res
    .status(404)
    .json({ error: "Not found. See GET /v1/info for available endpoints." });
});

export default router;
