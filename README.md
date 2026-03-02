# AI-Powered Worker Productivity Dashboard

This project is a small, production-style web application that ingests AI-generated computer vision events of worker activity, stores them in a database, computes productivity metrics, and displays them via a modern dashboard.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS (v4), Lucide React
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite
- **Containerization**: Docker, Docker Compose

## Quick Start
1. Ensure Docker Desktop is running.
2. Run `docker-compose up --build -d` in the root directory.
3. Access the dashboard at [http://localhost:5173](http://localhost:5173).
4. The database is automatically seeded on startup with realistic mock events for 6 workers and 6 workstations. You can refresh it anytime using the "Reset Demo Data" button.

> **Note on local running**: You can also run the backend (`npm run dev`) and frontend (`npm run dev`) locally with Node.js installed.

---

## 1. Architecture Overview
- **Edge**: AI-powered CCTV cameras capture and infer events locally. They encode events as JSON payloads and send them to the backend API over HTTPS/MQTT.
- **Backend (Ingestion layer)**: Receives, validates, and stores these events in a relational datastore (SQLite for this project, PostgreSQL for production).
- **Backend (Aggregating layer)**: Exposes endpoints like `/api/metrics/factory` that process these raw events into active/idle states and calculate metrics.
- **Dashboard (Presentation layer)**: Fetches metrics periodically or lazily and visualizes them using summarized cards and individual detail sheets.

## 2. Database Schema
Using SQLite for demonstration.
- `workers` (id, name): Master data for known employees.
- `workstations` (id, name): Master data for known operational zones.
- `events` (id, timestamp, worker_id, workstation_id, event_type, confidence, count): Immutable ledger of incoming events. We use foreign keys to tie events to their entities.
  
## 3. Metric Definitions
We parse the event stream based on state changes (e.g., transition from `working` to `idle`) and sum the durations.
- **Active Time**: Total duration a worker/workstation spent in the `working` state.
- **Idle Time**: Total duration spent in the `idle` state.
- **Utilization %**: `(Active Time / (Active Time + Idle Time)) * 100`.
- **Units Produced (Yield)**: Aggregated sum of `count` from `product_count` events.
- **UPH / Throughput Rate**: `Total Units / Active Time (in hours)`.

## 4. Assumptions and Tradeoffs
- **State durations**: We assume a worker remains in a given state (e.g., `working`) until a new state event arrives.
- **Current state capping**: If no new event arrives, the ongoing state is aggregated up to the current timestamp (or an arbitrary timeout limit like End-Of-Shift).
- **SQLite Performance**: Tradeoff made for simplicity in this assessment. SQLite struggles with high concurrent write throughput, so a real-world ingestion engine would use TimescaleDB, Kafka, or PostgreSQL.
- **Event Frequency**: Assumed 1 event roughly every few seconds per camera.

---

## Theoretical Questions & Advanced System Design

### A. Edge → Backend → Dashboard architecture
1. **Edge**: Runs object detection & action recognition models (e.g., YOLO + specialized tracking) via deep learning accelerators like Jetson Nanos. Pushes structured inference events (JSON) over MQTT or HTTP to the cloud ingestion layer.
2. **Backend**: An Ingestion API receives streams, passes them through a rate-limiter, validates schema, and writes to an event-store (e.g., Kafka or Amazon Kinesis). A consumer calculates real-time windows and writes states to PostgreSQL/TimescaleDB.
3. **Dashboard**: A frontend React app consumes materialized views or uses WebSockets for real-time live monitoring.

### B. Networking Resilience
- **Intermittent Connectivity**: Edge devices should have a local buffer (e.g., a local SQLite database or simple log files). When connectivity drops, events queue locally. Upon reconnection, they are synchronized to the cloud.
- **Out-of-Order Timestamps**: Because edge devices buffer and sync, events will arrive out-of-order. The backend must order events by the *origination timestamp*, not the ingestion timestamp, and use sliding windows or state recalculation to accommodate late-arriving data.
- **Duplicate Events**: We can utilize a composite unique constraint or idempotency keys (`device_id` + `local_event_timestamp` + random UUID generated at edge) so the backend simply ignores inserts of already-processed event IDs.

### C. ML Operations (MLOps)
- **Model Versioning**: Incorporate a `model_version` field in the inference event JSON. This allows backend segregation of metrics when A/B testing two different model versions.
- **Detecting Model Drift**: The backend can track average `confidence` scores. If we identify that confidence continuously falls below a threshold, or if the ratio of "unknown/idle" actions drastically inflates, it triggers a warning for data drift.
- **Trigger Retraining**: Save intermittent raw footage alongside instances of low-confidence events. Pass this to an active learning pipeline where human labelers annotate it, appending it to the training dataset. Trigger automated retraining in Vertex AI/SageMaker.

### D. Scaling from 5 to 100+ to Multi-Site
- **5 Cameras (Monolith)**: The current setup (Local Edge -> Node.js Express API -> PostgreSQL) is completely sufficient.
- **100+ Cameras**: Move ingestion to a message queue (Kafka or AWS Kinesis). Multiple API instances ingest events blindly. Dedicated background workers process the queue to calculate metrics to reduce latency on the dashboard API. Use TimescaleDB to handle massive time-series partitioning.
- **Multi-Site**: Introduce "Site ID" as a top-level hierarchy into the database and routing. Use globally distributed databases (like CockroachDB or AWS Aurora Global) to keep dashboard latency low for different physical factories. We would also employ multi-tenant architectures and Edge Kubernetes (like K3s) to deploy new ML models reliably across hundreds of remote gateways.
