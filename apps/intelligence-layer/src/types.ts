import type { ObjectId } from "mongodb";
import type { z } from "zod";
import type {
  SynthesisOutputSchema,
  ImpactOutputSchema,
  ValidationOutputSchema,
  ValidationCheckSchema,
} from "./schemas.js";

/** Data Scout GET /events/:event_id — matches apps/data-scout IngestedEventResponse */
export type DataScoutEventPayload = {
  event_id: string;
  source_event_id: string;
  category: string;
  headline: string;
  summary: string;
  severity: string;
  geographic_scope: string;
  location_country: string;
  location_region: string | null;
  source_reliability: string;
  status: string;
  affected_population_estimate: number | null;
  economic_impact_usd: number | null;
  casualties_confirmed: number | null;
  casualties_estimated: number | null;
  tags: string[];
  original_published_at: string;
  ingested_at: string;
  emitted_at: string | null;
};

export type StepName =
  | "synthesis"
  | "impact_evaluation"
  | "validation"
  | "relevance_matching"
  | "notification_signal";

export type PipelineOutcome = "notified" | "skipped" | "failed";

export type GeminiManifest = {
  model: string;
  common: {
    response_mime_type: string;
    timeout_ms: number;
    reasoning_field: string;
  };
  steps: Record<
    string,
    {
      temperature: number;
      max_output_tokens: number;
      reasoning_required: boolean;
      description?: string;
    }
  >;
  retry_policy: { enabled: boolean; note?: string };
};

export type IntelLogEntry = {
  timestamp: string;
  service: "intelligence-layer";
  level: "info" | "warn" | "error" | "debug";
  event_id: string | null;
  source: "ai_logs" | "pipeline" | "stream";
  message: string;
};

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
export type ImpactOutput = z.infer<typeof ImpactOutputSchema>;
export type ValidationCheck = z.infer<typeof ValidationCheckSchema>;
export type ValidationOutput = z.infer<typeof ValidationOutputSchema>;

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

export type PipelineSynthesisDoc = {
  _id?: ObjectId;
  event_id: string;
  source_event_id: string;
  pipeline_version: string;
  step: "synthesis";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id: ObjectId | null;
  source_severity_raw?: string;
  output?: SynthesisOutput;
  reasoning?: string;
};

export type PipelineImpactDoc = {
  _id?: ObjectId;
  event_id: string;
  pipeline_version: string;
  step: "impact_evaluation";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id: ObjectId | null;
  synthesis_ref: ObjectId | null;
  output?: ImpactOutput;
  reasoning?: string;
};

export type PipelineValidationDoc = {
  _id?: ObjectId;
  event_id: string;
  pipeline_version: string;
  step: "validation";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  ai_log_id: ObjectId | null;
  synthesis_ref: ObjectId | null;
  impact_evaluation_ref: ObjectId | null;
  output?: ValidationOutput;
  reasoning?: string;
};

export type PipelineRelevanceDoc = {
  _id?: ObjectId;
  event_id: string;
  pipeline_version: string;
  step: "relevance_matching";
  processed_at: string;
  status: "completed" | "failed";
  error: string | null;
  impact_evaluation_ref: ObjectId | null;
  validation_ref: ObjectId | null;
  output?: RelevanceOutput;
};

export type PipelineNotificationSignalDoc = {
  _id?: ObjectId;
  event_id: string;
  pipeline_version: string;
  step: "notification_signal";
  emitted_at: string;
  status: "emitted" | "failed";
  error: string | null;
  relevance_matching_ref: ObjectId | null;
  matched_user_count: number;
  stream_message_id: string | null;
};

export type AiLogDoc = {
  _id?: ObjectId;
  event_id: string;
  pipeline_version: string;
  step: "synthesis" | "impact_evaluation" | "validation";
  called_at: string;
  model: string;
  temperature: number;
  max_output_tokens?: number;
  prompt: string;
  response: string;
  tokens: { input: number; output: number };
  reasoning: string;
  duration_ms: number;
  status: "success" | "failed";
  error: string | null;
};

export type NotificationGatewayUser = {
  user_id: string;
  name?: string;
  channels: string[];
  severity_threshold: string;
};
