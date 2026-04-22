import type { Db } from "mongodb";

export const C = {
  pipeline_synthesis: "pipeline_synthesis",
  pipeline_impact_evaluation: "pipeline_impact_evaluation",
  pipeline_validation: "pipeline_validation",
  pipeline_relevance_matching: "pipeline_relevance_matching",
  pipeline_notification_signals: "pipeline_notification_signals",
  ai_logs: "ai_logs",
} as const;

export async function ensureIndexes(db: Db): Promise<void> {
  await db.collection(C.pipeline_synthesis).createIndex(
    { event_id: 1, pipeline_version: 1 },
    { name: "event_id_pipeline_version" }
  );
  await db.collection(C.pipeline_synthesis).createIndex(
    { processed_at: -1 },
    { name: "synthesis_processed_at" }
  );

  await db.collection(C.pipeline_impact_evaluation).createIndex(
    { event_id: 1, pipeline_version: 1 },
    { name: "impact_event_version" }
  );
  await db.collection(C.pipeline_validation).createIndex(
    { event_id: 1, pipeline_version: 1 },
    { name: "validation_event_version" }
  );
  await db.collection(C.pipeline_relevance_matching).createIndex(
    { event_id: 1, pipeline_version: 1 },
    { name: "relevance_event_version" }
  );
  await db.collection(C.pipeline_notification_signals).createIndex(
    { event_id: 1, pipeline_version: 1 },
    { name: "signal_event_version" }
  );
  await db.collection(C.pipeline_notification_signals).createIndex(
    { emitted_at: -1 },
    { name: "signal_emitted_at" }
  );
  await db.collection(C.ai_logs).createIndex(
    { event_id: 1, called_at: -1 },
    { name: "ai_logs_event_time" }
  );
  await db.collection(C.ai_logs).createIndex(
    { status: 1, called_at: -1 },
    { name: "ai_logs_status_time" }
  );
}
