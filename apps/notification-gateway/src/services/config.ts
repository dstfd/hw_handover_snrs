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

export type NotifGwConfig = {
  port: number;
  /** Own HTTP base URL for admin aggregation (local vs cloud via env only). */
  selfBaseUrl: string;
  redisUrl: string;
  intelBaseUrl: string;
  datascoutBaseUrl: string;
  magicballBaseUrl: string;
  jwtSecret: string;
  jwtExpiry: string;
};

export function loadConfig(): NotifGwConfig {
  const portRaw = process.env["NOTIF_GW_PORT"] ?? "4103";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port < 1) {
    throw new Error("NOTIF_GW_PORT must be a positive number");
  }

  const defaultSelf = `http://127.0.0.1:${port}`;

  return {
    port,
    selfBaseUrl: envString("NOTIF_GW_PUBLIC_URL", defaultSelf),
    redisUrl: envString("REDIS_URL", "redis://localhost:6379"),
    intelBaseUrl: envString("INTEL_BASE_URL", "http://localhost:4102"),
    datascoutBaseUrl: envString("DATASCOUT_BASE_URL", "http://localhost:4101"),
    magicballBaseUrl: envString("MAGICBALL_BASE_URL", "http://localhost:4100"),
    jwtSecret: envString("JWT_SECRET", "dev-only-change-in-production"),
    jwtExpiry: envString("JWT_EXPIRY", "24h"),
  };
}

export { envNumber };
