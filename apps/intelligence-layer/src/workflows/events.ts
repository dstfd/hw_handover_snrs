/**
 * Design parity with DOCS/application_design/intelligence-layer.md — typed workflow events.
 * The runtime orchestration is in intelligencePipeline.ts (sequential, Mongo-backed fetches).
 */
import type { PipelineOutcome } from "../types.js";

export type { PipelineOutcome };

export type PipelineStart = {
  event_id: string;
  source_event_id: string;
};

export type PipelineDone = {
  event_id: string;
  outcome: PipelineOutcome;
};
