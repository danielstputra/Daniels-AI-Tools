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

import express from "express";
import next from "next";
import cors from "cors";
import helmet from "helmet";
import {
  isPublisherEnabled,
  startPeriodicFlush,
  shutdownFlush,
} from "./lib/hf-publisher";
import backendRouter from "./backend";

const PORT = parseInt(process.env.PORT || "7860", 10); // HF Spaces default
const HOST = "0.0.0.0";

const nextApp = next({ dev: process.env.NODE_ENV !== "production" });
const handle = nextApp.getRequestHandler();

// ── Middleware ─────────────────────────────────────────────────────────
// CORS: Allow configured origins. When self-hosting, set CORS_ORIGIN=* to allow all.
const corsOrigins =
  process.env.CORS_ORIGIN === "*"
    ? true // Allow all origins (self-hosted / behind reverse proxy)
    : [
        process.env.CORS_ORIGIN ||
          "https://daniels-ai-tools-production.up.railway.app",
        ...(process.env.HF_SPACE_URL ? [process.env.HF_SPACE_URL] : []),
      ].filter(Boolean);

nextApp.prepare().then(() => {
  const server = express();

  server.use(cors({ origin: corsOrigins, credentials: false }));

  // Security headers via helmet
  server.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["https://fonts.gstatic.com"],
          connectSrc: [
            "'self'",
            "https://openrouter.ai",
            "https://*.openrouter.ai",
            "https://*.huggingface.co",
          ],
          imgSrc: ["'self'", "data:", "blob:"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      frameguard: { action: "deny" },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      permittedCrossDomainPolicies: false,
      xXssProtection: false, // X-XSS-Protection: 0 (modern best practice — CSP replaces it)
    }),
  );

  // Permissions-Policy (not covered by helmet)
  server.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
    );
    next();
  });

  // Middleware global
  server.use(express.json({ limit: "1mb" }));

  // Pasang router backend
  server.use("/v1", backendRouter);

  // Handler Next.js
  server.all(/(.*)/, (req, res) => handle(req, res));

  // Error handler
  server.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[API Error]", err.message);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  server.listen(PORT, HOST, () => {
    const hfStatus = isPublisherEnabled()
      ? `ON → ${process.env.HF_DATASET_REPO}`
      : "OFF (set HF_TOKEN + HF_DATASET_REPO to enable)";

    console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  DANIELS AI Research Preview API v0.4.0                     ║
  ║  Listening on http://${HOST}:${PORT}                       ║
  ║                                                          ║
  ║  TIERS:                                                  ║
  ║  FREE        5 req total, 10/min, 50/day                ║
  ║  PRO         unlimited, 60/min, 1000/day                ║
  ║  ENTERPRISE  unlimited, 300/min, 10000/day              ║
  ║                                                          ║
  ║  FLAGSHIP:                                               ║
  ║  POST /v1/ultraplinian/completions  Multi-model racing   ║
  ║  POST /v1/consortium/completions    Hive-mind synthesis  ║
  ║                                                          ║
  ║  ENGINES (all tiers):                                    ║
  ║  POST /v1/chat/completions     Single-model + DANIELS AI    ║
  ║  POST /v1/autotune/analyze     Context analysis          ║
  ║  POST /v1/parseltongue/encode  Text obfuscation          ║
  ║  POST /v1/transform            STM transforms            ║
  ║  POST /v1/feedback             Feedback loop             ║
  ║                                                          ║
  ║  GATED (Pro+):                                           ║
  ║  GET  /v1/dataset/export       Export dataset             ║
  ║  GET  /v1/research/stats       Published corpus stats    ║
  ║  GET  /v1/research/batches     List HF batch files       ║
  ║                                                          ║
  ║  GATED (Enterprise):                                     ║
  ║  GET  /v1/research/query       Query full corpus         ║
  ║  GET  /v1/research/download    Download corpus (JSONL)   ║
  ║  POST /v1/research/flush       Force-flush to HF         ║
  ║  GET  /v1/metadata/events      Raw metadata event log    ║
  ║                                                          ║
  ║  TIER CHECK:                                             ║
  ║  GET  /v1/tier                 Your tier + limits        ║
  ║                                                          ║
  ║  AUTO-PUBLISH: ${hfStatus.padEnd(39)}║
  ╚══════════════════════════════════════════════════════════╝
  `);

    if (!process.env.DANIELSAI_API_KEY && !process.env.DANIELSAI_API_KEYS) {
      console.warn(
        "  ⚠  WARNING: No DANIELSAI_API_KEY or DANIELSAI_API_KEYS set — all routes are unauthenticated!",
      );
    }

    if (!process.env.DANIELSAI_TIER_KEYS) {
      console.warn(
        "  ⚠  WARNING: No DANIELSAI_TIER_KEYS set — all keys default to free tier",
      );
    }

    if (!process.env.HF_TOKEN) {
      console.warn(
        "  ⚠  WARNING: HF_TOKEN not set — auto-publish to HuggingFace is DISABLED",
      );
    } else if (!process.env.HF_DATASET_REPO) {
      console.warn(
        "  ⚠  WARNING: HF_DATASET_REPO not set — auto-publish to HuggingFace is DISABLED (token is set but no target repo)",
      );
    }

    // Start periodic HF flush (no-op if not configured)
    startPeriodicFlush();
  });

  // ── Graceful Shutdown ─────────────────────────────────────────────────
  // Flush remaining metadata/dataset to HF before the container dies
  async function gracefulShutdown(signal: string) {
    console.log(`\n[${signal}] Shutting down...`);
    await shutdownFlush();
    process.exit(0);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});
