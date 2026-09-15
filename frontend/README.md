# NextGen Real-Time Test Hosting Platform

A full-stack Next.js 14+ (App Router) distributed assessment platform engineered for hosting scheduled MCQ tests with 500+ concurrent test-takers streaming answers in real time to a live virtualized admin monitoring dashboard.

---

## Architecture Overview

```
                        ┌──────────────────────────────┐
                        │   Load Balancer / Ingress    │
                        └──────────────┬───────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│ Node Process 1 (server.ts)    │             │ Node Process 2 (server.ts)    │
│ - Next.js App Router          │             │ - Next.js App Router          │
│ - Socket.IO Instance 1        │             │ - Socket.IO Instance 2        │
└──────────────┬────────────────┘             └───────────────┬───────────────┘
               │                                              │
               ├───────────────┬──────────────────────────────┤
               ▼               ▼                              ▼
      ┌────────────────┐ ┌─────────────────┐        ┌─────────────────┐
      │   MongoDB      │ │ Redis Pub/Sub   │        │ 500+ Connected  │
      │   (Mongoose)   │ │ (@socket.io/    │        │ Browsers        │
      │   Atomic Upsert│ │  redis-adapter) │        │ (Auto-Reconnect)│
      └────────────────┘ └─────────────────┘        └─────────────────┘
```

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router), React 19, TypeScript
- **Real-Time Engine**: Socket.IO with `@socket.io/redis-adapter` and `ioredis`
- **Server**: Custom Node HTTP server (`server.ts`) for persistent WebSocket state
- **Database**: MongoDB with Mongoose (compound indexes for atomic upsert and aggregations)
- **Authentication**: Custom JWT in `httpOnly`, `SameSite=Lax` cookies with `bcryptjs` password hashing
- **UI & Styling**: Tailwind CSS (dark mode palette, glassmorphism, responsive micro-animations)
- **Virtualization**: `@tanstack/react-virtual` for buttery-smooth rendering of 500+ live participant rows

---

## Data Models & Schema Design

1. **Admin (`models/Admin.ts`)**:
   - `email`: Unique lowercase email
   - `passwordHash`: Salted bcrypt hash
   - `role`: `"admin"`
2. **User (`models/User.ts`)**:
   - `name`: Full candidate name
   - `email`: Unique lowercase email
   - `passwordHash`: Admin-assigned initial temporary password
   - `mustChangePassword`: Boolean flag (enforces mandatory reset on first login)
   - `roomId`: Assigned test room identifier (e.g. `ROOM-CS-2026`)
3. **Test (`models/Test.ts`)**:
   - `title`: Test title
   - `scheduledStartTime`: Target start timestamp
   - `durationMinutes`: Total allotted duration
   - `status`: `"scheduled"` | `"live"` | `"ended"`
   - `questions`: Array of Question ObjectIds
   - `roomId`: Unique session room string
4. **Question (`models/Question.ts`)**:
   - `testId`: ObjectId reference to Test
   - `order`: Question sequence index
   - `text`: Question prompt
   - `options`: Array of `{ key: "a"|"b"|"c"|"d", text }`
   - `correctOption`: Kept server-side only; **never sent to client**
5. **Response (`models/Response.ts`)**:
   - `testId`, `userId`, `questionId`, `selectedOption`, `answeredAt`, `isFinal`
   - Compound index `{ testId: 1, userId: 1, questionId: 1 }` with `unique: true` for atomic re-answering without duplicates
   - Index `{ testId: 1 }` for live dashboard aggregation

---

## Deployment Differences: Persistent Node Server vs. Vercel Serverless

> [!IMPORTANT]
> **Why Vercel Serverless is NOT suitable for this platform:**
> Standard Vercel deployments run on ephemeral Edge / AWS Lambda serverless execution environments. Serverless functions freeze or terminate as soon as an HTTP response finishes; they **cannot hold persistent two-way WebSocket connections** needed by Socket.IO.
>
> This application is powered by `server.ts`, a persistent Node.js process. It must be deployed to platforms supporting long-running containers or VMs:
> - **Container Platforms**: AWS ECS (Fargate), Google Cloud Run (with WebSocket support enabled), Railway, Render, Fly.io, DigitalOcean App Platform.
> - **Kubernetes**: StatefulSet or Deployment behind an Nginx / Traefik Ingress with WebSocket connection upgrades.
> - **Dedicated VMs**: Ubuntu EC2 / Droplet managed by `pm2` (`pm2 start tsx --name test-portal -- server.ts`).

---

## Horizontal Scaling with Redis Pub/Sub Adapter

To support **500+ to 10,000+ concurrent test-takers**, multiple Node server pods run behind a layer 7 load balancer:

1. **Redis Pub/Sub Layer**:
   Each server instance attaches `@socket.io/redis-adapter` using duplicate pub/sub `ioredis` clients. When a student on **Server Pod A** submits an answer, the `admin:update` broadcast traverses Redis Pub/Sub, reaching the admin connected to **Server Pod B** instantly.
2. **Room Partitioning**:
   - Students join `test:{roomId}`.
   - Supervisors join `admin:{testId}`.
   - Broadcasts are strictly isolated per room so 500+ participants do not receive unneeded cross-traffic.
3. **Load Balancer Configuration**:
   Ensure sticky sessions (`ip_hash` or session affinity cookies) if using WebSocket fallback polling, or configure pure WebSocket transport.

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ or 20+
- MongoDB instance (local or MongoDB Atlas URI)
- Redis instance (optional for single-node local development; required for multi-pod clustering)

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/nextgen_test_portal
# REDIS_URL=redis://localhost:6379   # Uncomment if Redis is running locally
JWT_SECRET=super-secret-key-change-in-production-123456
PORT=3000
```

### 3. Seed Database
Run the seed script to populate an admin account, a sample scheduled test with questions, and 50 student candidates:
```bash
npm run seed
```

**Seed Credentials:**
- **Admin**: `admin@testportal.com` | Password: `Admin@123456`
- **Demo Ready Student**: `student@testportal.com` | Password: `User@123456`
- **New Student (Password Reset Demo)**: `newuser@testportal.com` | Password: `User@123456`

### 4. Run Development Server
```bash
npm run dev
```
The server starts at `http://localhost:3000`.

### 5. Simulate 500+ Concurrency Load (Optional)
To verify live virtualized updates and Redis performance under heavy load:
```bash
# Simulates 50 virtual test-takers streaming answers
npm run simulate

# Or simulate 500 test-takers
BOTS=500 npm run simulate
```

---

## Out of Scope (By Design)

The following capabilities are intentional architectural boundaries for this project:
- **Proctoring / Anti-Cheat**: Tab-switch detection, webcam AI monitoring, audio proctoring.
- **Results / Analytics Reports**: In-depth percentile rankings and score breakdowns beyond real-time response aggregation.
- **Email Delivery**: Automated SMTP/SendGrid emailing of initial credentials (admin distributes credentials out-of-band).
