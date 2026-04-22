import path from "node:path";

export type IntelConfig = {
  port: number;
  intelMongoUri: string;
  intelMongoDb: string;
  redisUrl: string;
  datascoutBaseUrl: string;
  notificationGwBaseUrl: string;
  gcpProjectId: string;
  gcpLocation: string;
  geminiManifestPath: string;
  pipelineVersion: string;
  minConfidenceThreshold: number;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v.trim();
}

function envString(name: string, defaultValue: string): string {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? defaultValue : v.trim();
}

function envNumber(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultValue;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number for ${name}: ${raw}`);
  }
  return n;
}

/**
 * Resolve manifest path: absolute paths as-is; relative paths from cwd (local dev / cloud use same code).
 */
export function resolveManifestPath(manifestPath: string): string {
  if (path.isAbsolute(manifestPath)) return manifestPath;
  return path.resolve(process.cwd(), manifestPath);
}

export function loadConfig(): IntelConfig {
  const portRaw = process.env["INTEL_PORT"] ?? "4102";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port < 1) {
    throw new Error("INTEL_PORT must be a positive number");
  }

  const manifestRel = envString("GEMINI_MANIFEST_PATH", "./gemini-connector.json");
  const geminiManifestPath = resolveManifestPath(manifestRel);

  return {
    port,
    intelMongoUri: envString("INTEL_MONGO_URI", "mongodb://localhost:27017"),
    intelMongoDb: envString("INTEL_MONGO_DB", "intelligence"),
    redisUrl: envString("REDIS_URL", "redis://localhost:6379"),
    datascoutBaseUrl: envString("DATASCOUT_BASE_URL", "http://localhost:4101"),
    notificationGwBaseUrl: envString(
      "NOTIFICATION_GW_BASE_URL",
      "http://localhost:4103"
    ),
    gcpProjectId: requireEnv("GCP_PROJECT_ID"),
    gcpLocation: envString("GCP_LOCATION", "us-central1"),
    geminiManifestPath,
    pipelineVersion: envString("PIPELINE_VERSION", "1.0"),
    minConfidenceThreshold: envNumber("MIN_CONFIDENCE_THRESHOLD", 0.5),
  };
}
