#!/usr/bin/env bash
# Health-gated local start: MagicBall → Data Scout → Intelligence Layer → Notification Gateway.
# Prerequisites: Redis, MongoDB, GEMINI_API_KEY for IL; seed notification-gateway users (see apps/notification-gateway/.env.example).
# Optional: SKIP_INTELLIGENCE=1 stops after Data Scout; SKIP_NOTIFICATION_GATEWAY=1 skips gateway (IL-only local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

wait_health() {
  local url=$1
  local name=$2
  for _ in $(seq 1 90); do
    if curl -sf "$url" >/dev/null; then
      echo "OK: $name"
      return 0
    fi
    sleep 1
  done
  echo "Timeout waiting for $name ($url)" >&2
  exit 1
}

pids=()

cleanup() {
  for p in "${pids[@]:-}"; do
    if kill -0 "$p" 2>/dev/null; then kill "$p" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT INT TERM

pnpm --filter magicball dev & pids+=($!)
wait_health "http://127.0.0.1:4100/health" "MagicBall"

pnpm --filter data-scout dev & pids+=($!)
wait_health "http://127.0.0.1:4101/health" "DataScout"

if [[ -n "${SKIP_INTELLIGENCE:-}" ]]; then
  echo "SKIP_INTELLIGENCE is set; not starting intelligence-layer or notification-gateway"
  wait
  exit 0
fi

pnpm --filter intelligence-layer dev & pids+=($!)
wait_health "http://127.0.0.1:4102/health" "IntelligenceLayer"

if [[ -n "${SKIP_NOTIFICATION_GATEWAY:-}" ]]; then
  echo "SKIP_NOTIFICATION_GATEWAY is set; not starting notification-gateway"
  echo "Three services are up. PIDs: ${pids[*]}. Press Ctrl+C to stop."
  wait
  exit 0
fi

pnpm --filter notification-gateway dev & pids+=($!)
wait_health "http://127.0.0.1:4103/health" "NotificationGateway"

echo "All four services are up. PIDs: ${pids[*]}. Press Ctrl+C to stop."
wait
