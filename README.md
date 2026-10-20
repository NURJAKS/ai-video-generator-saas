# AI Video Generation SaaS Platform

> **Scalable, event-driven AI Video Generation SaaS platform architected with a NestJS modular core, distributed BullMQ worker pipeline, multi-vendor AI orchestration (OpenAI, ElevenLabs, Fal.ai), FFmpeg media composition, real-time WebSocket telemetry, and an Angular 19 reactive presentation layer.**

[![NestJS](https://img.shields.io/badge/NestJS-11.0+-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Angular](https://img.shields.io/badge/Angular-19.2+-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.0+-orange?logo=redis&logoColor=white)](https://bullmq.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-Media_Engine-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

---

## Pitch & Executive Summary

**AI Video Generation SaaS** is a production-grade, distributed media generation system designed to transform natural language prompts into fully synchronized, narratively coherent video assets. By decoupling long-running media processing jobs from API request lifecycles through Redis-backed queues and event-driven worker daemons, the platform ensures consistent sub-50ms API response times while processing compute-heavy AI workflows.

The system encapsulates the complete product lifecycle: JWT-based stateless authentication, atomic credit billing with transactional reservation and rollback, multi-model AI synthesis (scriptwriting, voice cloning, visual rendering), automated FFmpeg video stitching, and bidirectional WebSocket progress streaming to an Angular 19 client.

---

## Architecture Overview

The platform implements an asynchronous, event-driven worker topology. Long-running generative tasks are quarantined into isolated worker processes managed by **BullMQ**, preventing CPU and network starvation on the primary HTTP ingress:

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Angular 19)"]
        UI["Reactive Dashboard / TailwindCSS"]
        WSClient["Socket.IO Client (Real-time Progress)"]
    end

    subgraph API ["Ingress & Application Core (NestJS 11)"]
        Gateway["REST Controllers & Auth Guards (JWT)"]
        CreditSvc["Credit Ledger (Atomic Reservation)"]
        QueueProducer["BullMQ Job Producer"]
        WSServer["Progress WebSocket Gateway"]
    end

    subgraph Queue ["Message Broker & Cache"]
        Redis[("Redis 7 (BullMQ Job State)")]
    end

    subgraph Workers ["Distributed Render Pipeline (WorkerHost)"]
        Worker["BullMQ Video Processor"]
        LLM["OpenAI GPT-4o (Script & Storyboard)"]
        TTS["ElevenLabs / OpenAI TTS (Voiceover)"]
        Visuals["Fal.ai (Generative Video & Keyframes)"]
        FFmpeg["FFmpeg Media Composer (Muxing & Audio Sync)"]
    end

    subgraph Storage ["Persistence Tier"]
        Postgres[("PostgreSQL 16 (TypeORM Entities)")]
        MediaStorage["Local / Volume Media Artifacts"]
    end

    UI -->|HTTP POST /api/generation| Gateway
    Gateway -->|Verify & Hold Credits| CreditSvc
    CreditSvc -->|Persist Transaction| Postgres
    Gateway -->|Dispatch VideoJobData| QueueProducer
    QueueProducer -->|Enqueue Job| Redis

    Redis -->|Consume Job| Worker
    Worker -->|1. Generate Script| LLM
    Worker -->|2. Synthesize Audio| TTS
    Worker -->|3. Generate Visuals| Visuals
    Worker -->|4. Stitch & Transcode| FFmpeg
    FFmpeg -->|Store .mp4| MediaStorage

    Worker -.->|Progress Updates (10%-100%)| WSServer
    WSServer -.->|WebSocket Emit| WSClient
    Worker -->|Finalize & Settle Credits| CreditSvc
```

### Architectural Highlights

- **Decoupled Job Lifecycle:** Heavy media synthesis is fully offloaded to background BullMQ processors. The HTTP API only acknowledges payload validity and returns a tracking `generationId`.
- **Atomic Credit Ledger:** Credits are reserved in a `PENDING` state before enqueuing. Upon successful compilation, credits are committed; if any upstream provider fails, the worker executes a compensating transaction that fully refunds the user.
- **Bi-Directional Telemetry via WebSockets:** Granular generation milestones (`script_ready`, `audio_synthesized`, `video_rendered`, `encoding_complete`) are emitted to the client room in real-time, eliminating HTTP polling.
- **Modular Multi-Vendor Provider Fallback:** Abstracted AI services layer allowing seamless swapping between OpenAI TTS and ElevenLabs, or Fal.ai and alternative video rendering backends without touching core domain services.

---

## Key Enterprise Features

### 1. Distributed Queue Pipeline with BullMQ & Redis
- High-throughput job scheduling with configurable worker concurrency, exponential backoff retries, and dead-letter queue isolation for malformed tasks.
- Resilient job state tracking with persistent Redis storage surviving container restarts.

### 2. Transactional Credit Ledger & SaaS Quota Enforcement
- ACID-compliant credit reservation logic utilizing PostgreSQL transactions via TypeORM.
- Dynamic pricing based on generation parameters (video length, resolution, selected voice model).
- Automatic refund semantics ensuring users are never billed for failed render passes.

### 3. Multi-Vendor Generative Media Pipeline
- **Prompt $\rightarrow$ Screenplay:** OpenAI GPT-4o crafts narrative structure, timing cues, and scene visual prompts.
- **Neural Voice Synthesis:** Dynamic switching between ElevenLabs high-fidelity voice cloning and OpenAI TTS.
- **Visual Composition:** Fal.ai integration for high-definition video frame and animation generation.
- **Hardware-Accelerated Encoding:** FFmpeg pipeline handling frame rate normalization, audio normalization, crossfades, and H.264/AAC MP4 encoding.

### 4. Real-Time Telemetry & Modern Reactive UI
- Angular 19 frontend utilizing Standalone Components and RxJS reactive streams.
- Live progress indicator with status steps (`0%` to `100%`) fed via Socket.IO events.
- Responsive dark-mode dashboard styled with TailwindCSS v4.

---

## Tech Stack & Architectural Rationale

| Layer | Technology | Architectural Rationale |
| :--- | :--- | :--- |
| **Backend Framework** | **NestJS 11** | Enterprise TypeScript architecture with strict modularity, dependency injection, and native OpenAPI Swagger generation. |
| **Job Queue & Broker** | **BullMQ 5 & Redis 7** | Non-blocking distributed background processing with rate limiting, retries, and low-latency state persistence. |
| **Database & ORM** | **PostgreSQL 16 & TypeORM** | Relational ACID guarantees for user authentication, credit ledgers, and video generation metadata records. |
| **Real-Time Communication** | **Socket.IO (@nestjs/platform-socket.io)** | Robust fallback-capable WebSocket transport for live progress streaming and user notification delivery. |
| **Frontend Framework** | **Angular 19 (Standalone)** | Enterprise SPA framework with typed templates, modular routing, and RxJS reactive state streams. |
| **Styling & CSS** | **TailwindCSS v4** | Modern utility-first design system ensuring low CSS bundle overhead and consistent typography. |
| **Media Engine** | **FFmpeg** | Industrial-grade video and audio muxing, filter graph execution, and multi-resolution transcoding. |
| **AI Providers** | **OpenAI, ElevenLabs, Fal.ai** | Best-of-breed multi-modal synthesis for script, voice, and visual generation. |
| **Containerization** | **Docker Compose** | Hermetic multi-container orchestration for PostgreSQL 16 and Redis 7 with healthchecks. |

---

## Repository Structure

```text
├── backend/
│   ├── src/
│   │   ├── admin/               # Administrative oversight and platform telemetry
│   │   ├── ai/                  # AI Provider integrations (OpenAI, ElevenLabs, Fal.ai)
│   │   ├── auth/                # JWT strategy, Passport guards, RBAC
│   │   ├── credits/             # Credit ledger entity, balance operations, history
│   │   ├── generation/          # Video generation module, DTOs, BullMQ Worker processors
│   │   ├── media/               # FFmpeg wrapper service & upload handling
│   │   ├── users/               # User entities and profile management
│   │   ├── websocket/           # Socket.IO progress gateway and room dispatcher
│   │   └── main.ts              # Application bootstrap & Swagger configuration
│   ├── .env.example             # Documented environment variables
│   ├── package.json             # Backend dependencies (NestJS 11, TypeORM, BullMQ)
│   └── tsconfig.json            # Strict TypeScript configuration
├── frontend/
│   ├── src/
│   │   ├── app/                 # Angular 19 standalone components and routes
│   │   └── assets/              # Static styling and UI assets
│   ├── package.json             # Frontend dependencies (Angular 19, Socket.IO client)
│   └── angular.json             # Angular CLI workspace configuration
├── docker-compose.yml           # Local infrastructure stack (Postgres 16 + Redis 7)
└── README.md                    # System architecture and documentation
```

---

## Getting Started

### Prerequisites

- **Node.js 20.x+** and **npm**
- **Docker & Docker Compose**
- **FFmpeg** installed locally (or running in container)

---

### Step 1: Start Infrastructure (PostgreSQL & Redis)

Launch the isolated backing services via Docker Compose:

```bash
docker compose up -d
```

Verify services are healthy:
```bash
docker compose ps
# videogen-postgres (healthy on 5432)
# videogen-redis    (healthy on 6379)
```

---

### Step 2: Configure & Run Backend

1. Navigate to backend directory:
   ```bash
   cd backend
   cp .env.example .env
   # Add your OpenAI, ElevenLabs, and Fal.ai API keys
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run database migrations / seeds:
   ```bash
   npm run typeorm -- migration:run -d src/config/data-source.ts
   # or run dev with auto-sync:
   npm run start:dev
   ```

4. Access API Documentation:
   - **Swagger UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

### Step 3: Configure & Run Frontend

1. Navigate to frontend directory:
   ```bash
   cd ../frontend
   npm install
   ```

2. Start Angular development server:
   ```bash
   npm start
   ```

3. Open in browser: [http://localhost:4200](http://localhost:4200)

---

## Verification & Workflow Test

1. **Register / Login:** Authenticate via `/api/auth/register` and obtain a JWT bearer token.
2. **Check Balance:** Verify initial promotional credits via `/api/credits/balance`.
3. **Dispatch Video Generation:** Send `POST /api/generation` with topic prompt, voice ID, and target duration.
4. **Observe Progress:** Connect to WebSocket gateway `/progress` to receive real-time stage updates from the BullMQ worker.
5. **Download Artifact:** Retrieve the finished `.mp4` video from `/api/media/download/{id}`.

---

## Known Limitations & Production Roadmap

- **Distributed Object Storage:** The local file storage implementation is ready to be swapped with an AWS S3 / Cloudflare R2 presigned URL pipeline for distributed worker nodes.
- **GPU Cluster Scaling:** Worker processors can be packaged as standalone container images deployed on Kubernetes with GPU node selectors (KEDA autoscaling on BullMQ queue depth).
- **Webhook Callbacks:** In addition to WebSockets, support for asynchronous HTTP webhook callbacks for headless enterprise integrations.

---

## License

This project is licensed under the MIT License.
