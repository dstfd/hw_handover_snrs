# Sonrisa — Alert System

A full-stack event processing and notification system that ingests, analyzes, and delivers alerts across multiple channels (Email, Slack). Built as a monorepo with TypeScript, Next.js, Fastify, and Google Vertex AI.

## Project Overview

Sonrisa processes real-world events (breaking news, market movements, natural disasters) through an intelligent pipeline and delivers notifications to users based on their subscriptions. The system emphasizes **lineage tracking**, **deterministic processing**, and **extensibility**.

### Architecture

```
MagicBall (Data Source)
    ↓
Data Scout (Ingestion) → Redis Streams
    ↓
Intelligence Layer (Pipeline) → MongoDB
    ↓
Notification Gateway (Delivery) → Email/Slack
    ↓
UI (Admin & User Interface)
```

## Services

### **MagicBall** (`apps/magicball`)
- Mock event source API
- Pre-generates events in three categories: breaking news, market movements, natural disasters
- Exposes `/events` endpoint with temporal filtering
- **Stack:** Fastify, SQLite

### **Data Scout** (`apps/data-scout`)
- Polls MagicBall every 5 minutes for new events
- Assigns stable `event_id` (UUID v4) to each event — the lineage spine
- Deduplicates and persists raw event payloads
- Emits events to Redis Streams for downstream processing
- **Stack:** Fastify, SQLite, Redis

### **Intelligence Layer** (`apps/intelligence-layer`)
- Main processing pipeline with five stages:
  1. Event synthesis (normalize, enrich, generate facts)
  2. Impact evaluation (assess significance)
  3. Validation (sanity-check output)
  4. Relevance matching (match against user subscriptions)
  5. Notification signal emission
- Each step is **discrete and independently replayable**
- Full schema validation with **Zod**
- Includes Vertex AI integration for semantic understanding
- **Stack:** Fastify, MongoDB, Google Vertex AI, Zod, TypeScript

### **Notification Gateway** (`apps/notification-gateway`)
- Consumes notification signals from Redis Streams
- Implements delivery channels: Email, Slack
- Designed for extensibility (add new channels without structural changes)
- JWT-based authentication, bcrypt password hashing
- **Stack:** Fastify, SQLite, Redis, JWT, bcryptjs

### **UI** (`apps/ui`)
- Next.js 15 frontend application
- Admin tools for viewing pipeline runs and processing artifacts
- User-facing subscription management and notification history
- Radix UI components with Tailwind CSS
- Proxy authentication to backend services
- **Stack:** Next.js, React 19, TypeScript, Tailwind CSS

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (or npm/yarn)
- **Docker** (optional, for Redis if not using local)
- **Google Cloud credentials** (for Vertex AI, optional for basic testing)

### Installation

```bash
# Install dependencies
pnpm install

# Build TypeScript across all workspaces
pnpm -r build
```

### Environment Setup

Create `.env` files in each app directory as needed:

```bash
# apps/intelligence-layer/.env (for Vertex AI)
VERTEX_PROJECT_ID=your-gcp-project
VERTEX_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# apps/ui/.env.local (for backend proxying)
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Running Locally

#### Option 1: Start All Services (Recommended)

```bash
# Starts all services in parallel
pnpm dev:stack
```

This runs:
- **MagicBall**: http://localhost:3001
- **Data Scout**: http://localhost:3002
- **Intelligence Layer**: http://localhost:3003
- **Notification Gateway**: http://localhost:3004
- **UI**: http://localhost:4104

#### Option 2: Start Individual Services

```bash
pnpm dev:magicball          # Data source
pnpm dev:datascout          # Ingestion
pnpm dev:intelligence       # Pipeline
pnpm dev:notification-gateway
pnpm dev:ui                 # Frontend
```

### Running Tests

```bash
# Intelligence Layer tests (unit + integration)
pnpm --filter intelligence-layer test

# Intelligence Layer + Vertex AI e2e test (requires GCP credentials)
pnpm --filter intelligence-layer test:vertex-e2e

# Notification Gateway tests
pnpm --filter notification-gateway test
```

## Project Structure

```
sonrisa/
├── apps/
│   ├── magicball/               # Event source
│   ├── data-scout/              # Ingestion
│   ├── intelligence-layer/      # AI pipeline
│   ├── notification-gateway/    # Delivery
│   └── ui/                      # Next.js frontend
├── DOCS/
│   └── application_design/      # Architecture & design docs
├── evidence_of_work/            # Assessment documentation
├── scripts/
│   └── start.sh                 # Multi-service startup
├── tsconfig.base.json           # Shared TypeScript config
└── pnpm-workspace.yaml          # Monorepo workspace
```

## Key Design Decisions

### Event Lineage Tracking
Every event is assigned a stable `event_id` at ingestion (Data Scout). This ID flows through the entire pipeline, enabling complete traceability from source to notification delivery.

### Deterministic Pipeline
Intelligence Layer steps are **discrete and independently replayable**. This enables:
- Debugging individual pipeline stages
- Replaying events after code fixes
- Clear separation of concerns

### Document-Native Persistence
- **SQLite** for transactional data (events, logs, subscriptions)
- **MongoDB** for pipeline artifacts (variable-shaped documents)
- **Redis Streams** as the event bus

### Extensible Channels
Notification Gateway architecture allows new delivery channels (SMS, Push, Webhooks) to be added without modifying the core pipeline.

## API Endpoints

### MagicBall
- `GET /events` — List events (supports `since` query param)

### Data Scout
- `GET /health` — Service health
- `GET /poll-state` — Current ingestion cursor

### Intelligence Layer
- `POST /process` — Submit event for pipeline processing
- `GET /pipeline-runs` — List processing history
- `GET /pipeline-runs/:eventId` — Get processing details for event

### Notification Gateway
- `POST /subscribe` — Create user subscription
- `POST /send` — Trigger notification delivery
- `GET /notifications` — Notification history

### UI
- `http://localhost:4104` — Admin and user dashboard

## Documentation

Detailed design documentation is available in `/DOCS/application_design/`:

- **design-brief.md** — System overview and problem statement
- **magicball.md** — Event source design
- **data-scout.md** — Ingestion service design
- **intelligence-layer.md** — Pipeline architecture and validation schema
- **notification-gateway.md** — Delivery system design
- **ui.md** — Frontend architecture

## Development Notes

### Adding a New Notification Channel

1. Create a new channel interface in `notification-gateway/src/channels/`
2. Implement the channel handler (e.g., `TwilioChannel`)
3. Register in the channel factory
4. No changes needed to the pipeline

### Debugging Pipeline Runs

The Intelligence Layer stores complete processing logs in MongoDB. Replay any event:

```bash
# Check a specific pipeline run
curl http://localhost:3003/pipeline-runs/:eventId
```

### Local Database Reset

```bash
# MagicBall
pnpm --filter magicball reset

# Data Scout
pnpm --filter data-scout reset

# Notification Gateway
pnpm --filter notification-gateway reset
```

## Testing Strategy

- **Unit tests** for business logic
- **Integration tests** for service communication
- **E2E tests** for Vertex AI (optional, GCP-dependent)
- Test data is seeded via `scripts/seed.ts` in each service

## Troubleshooting

**Redis not connecting?**
- Ensure Redis is running locally or update connection strings in `.env`

**MongoDB connection failed?**
- Check MongoDB is accessible (local or via connection string in `.env`)

**Vertex AI tests fail?**
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to valid GCP service account JSON

**UI not loading backend data?**
- Verify backend services are running on expected ports
- Check browser console for proxy errors

## Assessment Context

This project was built as a comprehensive assessment demonstrating:

- **Full-stack architecture design** (5-service monorepo)
- **Event-driven systems** with lineage tracking
- **Schema validation** using Zod
- **Asynchronous processing** with message buses
- **API design** and service boundaries
- **Testing strategies** (unit, integration, e2e)
- **Documentation** practices
- **Modern TypeScript** development

### Evidence of Work

Detailed implementation notes and design decisions are documented in `/evidence_of_work/`:

- **Diagrams** — Architecture and data flow diagrams (`.excalidraw` format — open with [Excalidraw](https://excalidraw.com) or Excalidraw VS Code extension)
- **Screenshots** — UI mockups and implementation screenshots
- **Pipeline Results** — Example pipeline runs and processing artifacts
- **Cursor Sessions** — Development process documentation from AI coding sessions
- **Claude Prompts** — Prompts used for implementation guidance

To view Excalidraw diagrams:
1. Open https://excalidraw.com
2. Upload the `.excalidraw` file from `evidence_of_work/diagram_excalidraw/`
3. Or use the [Excalidraw VS Code extension](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor) for inline viewing

## License

Assessment project — internal use only.
