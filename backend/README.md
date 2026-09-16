# NextGen Assessment Portal — High-Stakes Testing Platform

A high-performance, fault-tolerant computer-based testing and proctoring platform designed for universities, competitive entrance examinations, and enterprise assessments.

---

## Key Architectural Pillars

### 1. Server-Authoritative Timing & Determinism
- Timers are computed strictly against the server-side start time and duration constraints, eliminating client-side tampering.
- Scoring and ranking are strictly deterministic with negative marking support and duration tie-breakers.

### 2. High-Integrity Proctoring Shield
- **Fullscreen Enforcement**: Candidates must maintain fullscreen mode; exits trigger automated incident warnings and server logging.
- **Tab-Switch & Blur Detection**: Navigating away from the exam or blurring the browser window logs a violation event immediately dispatched to the proctoring monitor via WebSockets.
- **Copy/Paste & Right-Click Restrictions**: Context menu and clipboard copying are blocked on examination pages.
- **Live Broadcast Alerts**: Administrators can dispatch instant high-priority announcement banners to all active test-takers in real time.

### 3. Question Palette & Active Attempt State Machine
- Dynamic question grid with color-coded status tracking:
  - 🟢 **Answered**
  - 🔘 **Unanswered / Visited**
  - 🟣 **Marked for Review**
  - 🟠 **Answered & Marked for Review**
  - ⚪ **Not Visited**
- Supports Single-Choice MCQ, Multiple Selection, Short Answer, and Fill-in-the-Blank with sub-second answer auto-save.

### 4. Admin Command Center & Psychometric Analytics
- **Live Proctor Command Center**: Real-time telemetry feed showing candidate connection status, progress %, tab switch count, and last ping.
- **Deterministic Leaderboard**: Instant rank calculations with single-click styled Excel (`.xlsx` via `openpyxl`) and `.csv` exports.
- **Question Analytics**: Real-time solve accuracy rates, difficulty tiers, and option distractor distribution histograms.
- **Candidate Roster**: Single student creation and bulk CSV import with automated column mapping.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Zustand, CSS Design System, Lucide Icons |
| **Backend** | FastAPI (Python 3.10+), Pydantic v2, Motor (Async MongoDB), Redis (Pub/Sub & Cache), OpenPyXL |
| **Infrastructure** | Docker, Docker Compose, MongoDB 7.0, Redis 7.2 |

---

## Quick Start Guide

### Option A: Running via Docker Compose (Recommended)

```bash
docker-compose up --build
```
- **Frontend Portal**: `http://localhost:3000`
- **FastAPI Backend & Swagger**: `http://localhost:8000/docs`
- **MongoDB**: `localhost:27017`
- **Redis**: `localhost:6379`

### Option B: Running Locally

#### 1. Start MongoDB & Redis
Ensure MongoDB is running on `mongodb://localhost:27017` and Redis on `redis://localhost:6379`.

#### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python seed.py
uvicorn main:app --reload --port 8000
```

#### 3. Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Demo Credentials

| Role | Identifier | Password | Access Area |
|---|---|---|---|
| **Administrator** | `admin@nextgen.local` | `Admin@1234` | `/admin/dashboard` |
| **Student (Candidate 1)** | `CS2026001` | `Student@1234` | `/student/dashboard` |
| **Student (Candidate 2)** | `CS2026002` | `Student@1234` | `/student/dashboard` |
| **Student (Candidate 3)** | `CS2026003` | `Student@1234` | `/student/dashboard` |

*(Note: The login page also features one-click "Admin Demo" and "Student Demo" autofill buttons for instant testing).*

---

## Verification & Testing

1. **Frontend Production Build**:
   ```bash
   cd frontend
   npm run build
   ```
   Verified: Clean production compile across all 15 static and dynamic routes.

2. **Backend Import & Config Verification**:
   ```bash
   python -c "import sys; sys.path.insert(0, '.'); from app.core.config import settings; print('Config OK')"
   ```
