/** Matches notification-gateway UserPublic / rowToPublic. */
export type UserPublic = {
  user_id: string;
  name: string;
  email: string | null;
  slack_channel: string | null;
  severity_threshold: string;
  channels: string[];
  role: "user" | "admin";
  event_categories: string[];
  created_at: string;
  is_active: boolean;
};

export type LoginResponse = {
  token: string;
  user: {
    user_id: string;
    name: string;
    email: string | null;
    role: "user" | "admin";
  };
};

export type PipelineRunSummary = {
  event_id: string;
  processed_at: string;
  outcome: "notified" | "skipped" | "failed";
  matched_user_count: number;
};

export type PipelineListResponse = {
  data: PipelineRunSummary[];
  page: number;
  limit: number;
  total: number;
};

export type SynthesisOutput = {
  headline: string;
  category: string;
  event_status: string;
  date: string;
  temporal: {
    is_developing: boolean;
    estimated_duration: string;
  };
  facts: string[];
  entities: {
    people: string[];
    organizations: string[];
    locations: string[];
    assets: string[];
  };
  geo: {
    country: string;
    region: string | null;
    scope: string;
    coordinates: null;
  };
  affected_population: number | null;
  economic_dimension: {
    has_economic_impact: boolean;
    impact_usd: number | null;
    affected_sectors: string[];
  };
  casualties: { confirmed: number | null; estimated: number | null };
  tags: string[];
  provenance: {
    source_reliability: string;
    named_sources: string[];
    provenance_note: string;
  };
  confidence: { score: number; reasoning: string };
};

export type ImpactOutput = {
  severity: string;
  urgency: string;
  global_effect: string;
  impact_dimensions: {
    human: { score: number; notes: string };
    economic: { score: number; notes: string };
    infrastructure: { score: number; notes: string };
    geopolitical: { score: number; notes: string };
  };
  overall_impact_score: number;
  confidence: { score: number; factors: string[] };
  source_reliability_adjustment: string;
};

export type ValidationCheck = {
  check: string;
  passed: boolean;
  note: string;
};

export type ValidationOutput = {
  is_valid: boolean;
  proceed: boolean;
  checks: ValidationCheck[];
  validation_summary: string;
};

export type RelevanceOutput = {
  event_severity: string;
  matched_users: Array<{
    user_id: string;
    channels: string[];
    severity_threshold: string;
    match_reason: string;
  }>;
  total_matched: number;
  notification_warranted: boolean;
};

export type StepName =
  | "synthesis"
  | "impact_evaluation"
  | "validation"
  | "relevance_matching"
  | "notification_signal";

export type PipelineSynthesisDoc = {
  _id?: string;
  event_id: string;
  source_event_id: string;
  pipeline_version: string;
  step: "synthesis";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id?: string | null;
  output?: SynthesisOutput;
  reasoning?: string;
};

export type PipelineImpactDoc = {
  _id?: string;
  event_id: string;
  pipeline_version: string;
  step: "impact_evaluation";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id?: string | null;
  synthesis_ref?: string | null;
  output?: ImpactOutput;
  reasoning?: string;
};

export type PipelineValidationDoc = {
  _id?: string;
  event_id: string;
  pipeline_version: string;
  step: "validation";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id?: string | null;
  synthesis_ref?: string | null;
  impact_evaluation_ref?: string | null;
  output?: ValidationOutput;
  reasoning?: string;
};

export type PipelineRelevanceDoc = {
  _id?: string;
  event_id: string;
  pipeline_version: string;
  step: "relevance_matching";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  impact_evaluation_ref?: string | null;
  validation_ref?: string | null;
  output?: RelevanceOutput;
};

export type PipelineNotificationSignalDoc = {
  _id?: string;
  event_id: string;
  pipeline_version: string;
  step: "notification_signal";
  emitted_at: string;
  status: "emitted" | "failed";
  error: string | null;
  relevance_matching_ref?: string | null;
  matched_user_count: number;
  stream_message_id?: string | null;
};

export type PipelineDetailResponse = {
  event_id: string;
  pipeline_version: string;
  outcome: "notified" | "skipped" | "failed" | "incomplete";
  matched_user_count: number;
  steps: {
    synthesis: PipelineSynthesisDoc | null;
    impact_evaluation: PipelineImpactDoc | null;
    validation: PipelineValidationDoc | null;
    relevance_matching: PipelineRelevanceDoc | null;
    notification_signal: PipelineNotificationSignalDoc | null;
  };
};

export type UnifiedLogEntry = {
  timestamp: string;
  service: string;
  level: string;
  event_id: string | null;
  source: string;
  message: string;
};

export type AdminLogsResponse = {
  data: UnifiedLogEntry[];
  page: number;
  limit: number;
  total: number;
};

export type AdminHealthResponse = {
  services: Array<{
    name: string;
    status: "up" | "down" | "degraded";
    detail: unknown;
  }>;
  checked_at: string;
};

export type UsersListResponse = {
  users: UserPublic[];
};
