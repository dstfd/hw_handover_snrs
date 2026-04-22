export type SeverityLevel = "low" | "medium" | "high" | "critical";

export type UserRole = "user" | "admin";

export type UserRow = {
  user_id: string;
  name: string;
  email: string | null;
  slack_channel: string | null;
  severity_threshold: string;
  channels: string;
  role: string;
  password_hash: string;
  event_categories: string;
  created_at: string;
  is_active: number;
};

/** Public user (no password). */
export type UserPublic = {
  user_id: string;
  name: string;
  email: string | null;
  slack_channel: string | null;
  severity_threshold: string;
  channels: string[];
  role: UserRole;
  event_categories: string[];
  created_at: string;
  is_active: boolean;
};

/** Intelligence Layer internal relevance response shape. */
export type RelevanceUserResponse = {
  user_id: string;
  channels: string[];
  severity_threshold: string;
  name?: string;
};

export type GatewayLogEntry = {
  timestamp: string;
  service: "notification-gateway";
  level: "info" | "warn" | "error" | "debug";
  event_id: string | null;
  source: string;
  message: string;
};

export type JwtPayload = {
  user_id: string;
  role: UserRole;
  iat: number;
  exp: number;
};

export type NotificationPayload = {
  event_id: string;
  headline: string;
  facts: string[];
  severity: string;
  sent_at: string;
};
