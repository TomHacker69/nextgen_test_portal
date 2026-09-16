# Product Requirements Document: NextGen Test Portal

## 1. Overview

### 1.1 Product Description
The NextGen Test Portal is an assessment platform enabling administrators to create tests with multiple-choice questions, schedule them, and monitor live results. Students take tests in real-time with proctoring features.

### 1.2 Architecture Summary
This is a **dual-backend architecture**:
- **Primary Stack**: Express.js backend (`frontend/server/`) + Next.js frontend (`frontend/app/`) — used by both user and admin apps
- **Standalone Stack**: FastAPI backend (`backend/backend/`) — separate Python microservice

### 1.3 Components
| Component | Location | Port | Description |
|-----------|----------|------|-------------|
| User Frontend | `frontend/` | 3000 | Next.js app with custom Socket.IO server |
| Admin Frontend | `admin/` | 3001 | Standalone Next.js 16 app |
| Express API | `frontend/server/` | 4000 | Node.js/Express backend (Mongoose/MongoDB) |
| FastAPI | `backend/backend/` | 8000 | Python/FastAPI backend (Motor/MongoDB) |
| Redis | root compose | 6379 | Queue and session storage |
| Worker | `frontend/server/` | — | Background job processor |

---

## 2. Directory Structure

```
nextgen_test_portal/
├── frontend/                          # Monorepo: Next.js app + Express server + packages
│   ├── app/                           # Next.js application (user-facing)
│   │   ├── app/                       # App router pages
│   │   ├── components/                # Shared React components
│   │   ├── lib/                       # Client utilities
│   │   ├── server/                    # Server-side code
│   │   ├── styles/                    # CSS/Sass files
│   │   └── ...
│   ├── server/                        # Express backend
│   │   ├── src/
│   │   │   ├── configs/              # Mongoose configs
│   │   │   ├── controllers/          # Request controllers
│   │   │   ├── middleware/           # Auth, error handling
│   │   │   ├── models/               # Mongoose models (User, Test, Question, etc.)
│   │   │   ├── routes/               # API routes
│   │   │   ├── sockets/              # Socket.IO handlers
│   │   │   │   ├── socketServer.ts
│   │   │   │   └── socketHandler.ts
│   │   │   ├── services/             # Email, file processing
│   │   │   ├── utils/                # Helpers
│   │   │   ├── validators/           # Request validation
│   │   │   └── index.ts              # Express app entry
│   │   ├── Dockerfile
│   │   └── tsconfig.json
│   ├── lib/
│   │   ├── socketServer.ts           # Re-export from server/src/sockets
│   │   └── ...
│   ├── packages/
│   │   └── db/                       # Shared DB package
│   │       └── src/
│   │           └── index.ts
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   ├── turbo.json
│   └── ...
├── admin/                             # Standalone admin panel (Next.js 16)
│   ├── app/
│   │   ├── dashboard/
│   │   ├── tests/
│   │   ├── stats/
│   │   ├── users/
│   │   ├── login/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── ...
│   ├── components/
│   │   ├── AdminLayout.tsx
│   │   ├── AuthGuard.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── auth-context.tsx
│   │   └── api.ts
│   ├── next.config.mjs
│   ├── package.json
│   ├── tsconfig.json
│   └── ...
├── backend/                           # Standalone FastAPI backend
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── v1/
│   │   │   │   │   ├── auth.py
│   │   │   │   │   ├── tests.py
│   │   │   │   │   ├── questions.py
│   │   │   │   │   ├── analytics.py
│   │   │   │   │   └── ...
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── database.py
│   │   │   │   └── ...
│   │   │   ├── models/
│   │   │   │   ├── user.py
│   │   │   │   ├── test.py
│   │   │   │   └── ...
│   │   │   ├── schemas/
│   │   │   │   ├── auth.py
│   │   │   │   ├── test.py
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   ├── auth_service.py
│   │   │   │   ├── test_service.py
│   │   │   │   └── ...
│   │   │   └── main.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── ...
│   ├── docker-compose.yml
│   └── ...
├── docker-compose.yml                 # Root compose (web, api, worker, redis)
└── ...
```

---

## 3. Technologies

### 3.1 Frontend (Admin - `admin/`)
- **Framework**: Next.js 16.3.5
- **Styling**: Tailwind CSS v4, PostCSS
- **Build**: ESLint, TypeScript
- **UI**: Lucide React, Radix UI
- **Deployment**: Standalone Node.js server or Docker

### 3.2 Frontend (User - `frontend/`)
- **Framework**: Next.js (App Router)
- **Server**: Custom Next.js server with Socket.IO (`server.ts`)
- **State Management**: React Context
- **Styling**: Tailwind CSS

### 3.3 Backend (Express - `frontend/server/`)
- **Runtime**: Node.js, TypeScript
- **Framework**: Express.js
- **Database**: Mongoose ODM (MongoDB)
- **Authentication**: JWT, `jsonwebtoken`, 7-day expiry
- **Auth Cookie**: `auth_token`
- **Real-time**: Socket.IO (v4)
- **Queues**: BullMQ (Redis)
- **Email**: Nodemailer
- **File Upload**: Multer
- **Validation**: Zod, express-validator

### 3.4 Backend (FastAPI - `backend/`)
- **Runtime**: Python 3.x
- **Framework**: FastAPI
- **Database**: Motor (async MongoDB ODM)
- **Authentication**: JWT, `python-jose`, `passlib`
- **Auth Cookie**: `access_token`
- **Validation**: Pydantic v2
- **Password Hashing**: bcrypt
- **Documentation**: Auto-generated OpenAPI/Swagger

---

## 4. Authentication

### 4.1 Express Backend (Primary)
- **Token**: `auth_token` cookie
- **Library**: `jsonwebtoken`
- **Expiry**: 7 days
- **Roles**: `admin`, `user`
- **Flow**: POST `/api/auth/register` or `/api/auth/login` → sets `auth_token` cookie
- **Middleware**: `authMiddleware` verifies token, extracts user

### 4.2 FastAPI Backend (Standalone)
- **Token**: `access_token` cookie
- **Library**: `python-jose`
- **Expiry**: Configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- **Roles**: `admin`, `student`
- **Flow**: POST `/api/auth/login` → sets `access_token` cookie
- **Middleware**: `get_current_user` dependency

---

## 5. API Endpoints

### 5.1 Express API (`frontend/server/` - Port 4000)

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login + set auth_token cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Password reset email |
| POST | `/api/auth/reset-password` | Reset password |

#### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/tests` | List all tests |
| POST | `/api/admin/tests` | Create test (fields: title, description, duration, startTime, endTime, roomId) |
| GET | `/api/admin/tests/:id` | Get test details |
| PUT | `/api/admin/tests/:id` | Update test |
| DELETE | `/api/admin/tests/:id` | Delete test |
| POST | `/api/admin/tests/:id/questions` | Add question to test |
| GET | `/api/admin/tests/:id/questions` | List test questions |
| GET | `/api/admin/tests/:testId/stats` | Get test statistics |
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/stats` | Admin statistics |

#### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tests` | List available tests |
| GET | `/api/tests/:id` | Get test details |
| POST | `/api/tests/:id/start` | Start test attempt |
| POST | `/api/tests/:id/submit` | Submit test |
| GET | `/api/results` | Get user results |
| GET | `/api/results/:testId` | Get specific test result |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

### 5.2 FastAPI (Standalone - Port 8000)

#### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login + set access_token cookie |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Get current user |

#### Tests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tests` | List tests |
| POST | `/api/v1/tests` | Create test (admin only) |
| GET | `/api/v1/tests/{id}` | Get test details |
| PUT | `/api/v1/tests/{id}` | Update test |
| DELETE | `/api/v1/tests/{id}` | Delete test |

#### Questions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tests/{test_id}/questions` | List questions |
| POST | `/api/v1/tests/{test_id}/questions` | Add question |
| PUT | `/api/v1/questions/{id}` | Update question |
| DELETE | `/api/v1/questions/{id}` | Delete question |

#### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | Dashboard stats |
| GET | `/api/v1/analytics/test/{test_id}` | Test analytics |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

---

## 6. Database Schema (Express/Mongoose)

### 6.1 User
```
User {
  _id: ObjectId
  name: string
  email: string (unique)
  password: string (hashed)
  role: 'admin' | 'user'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  lastLogin: Date
}
```

### 6.2 Test
```
Test {
  _id: ObjectId
  title: string
  description: string
  duration: number (minutes)
  startTime: Date
  endTime: Date
  roomId: string
  createdBy: ObjectId (User)
  questions: ObjectId[] (Question refs)
  isActive: boolean
  settings: {
    allowPause: boolean
    showResults: boolean
    shuffleQuestions: boolean
    shuffleOptions: boolean
  }
  createdAt: Date
  updatedAt: Date
}
```

### 6.3 Question
```
Question {
  _id: ObjectId
  test: ObjectId (Test ref)
  questionText: string
  options: string[]
  correctOption: number (index)
  marks: number
  negativeMarks: number
  explanation: string
  type: 'mcq' | 'short_answer' | 'long_answer'
  createdAt: Date
  updatedAt: Date
}
```

### 6.4 TestAttempt / Result
```
TestResult {
  _id: ObjectId
  test: ObjectId (Test ref)
  user: ObjectId (User ref)
  answers: [{
    question: ObjectId (Question ref)
    selectedOption: number
    marks: number
    isCorrect: boolean
  }]
  score: number
  totalMarks: number
  timeTaken: number (seconds)
  startTime: Date
  endTime: Date
  status: 'in_progress' | 'submitted' | 'timeout'
  createdAt: Date
  updatedAt: Date
}
```

### 6.5 Live Room / Proctoring
```
LiveSession {
  _id: ObjectId
  roomId: string
  test: ObjectId (Test ref)
  participants: [{
    userId: ObjectId
    socketId: string
    isProctor: boolean
    joinedAt: Date
  }]
  isActive: boolean
  createdAt: Date
}
```

---

## 7. Socket.IO Events

### 7.1 Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_room` | `{ roomId, userId }` | Join test room |
| `leave_room` | `{ roomId, userId }` | Leave test room |
| `question_answered` | `{ roomId, userId, questionId, answer }` | Broadcast answer |
| `test_started` | `{ roomId, userId, testId }` | Test start event |
| `test_submitted` | `{ roomId, userId, testId }` | Test submit event |
| `proctor_warning` | `{ roomId, userId, warning }` | Proctoring alert |
| `heartbeat` | `{ roomId, userId }` | Keep-alive |
| `live_stats` | `{ roomId }` | Request live stats |

### 7.2 Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `user_joined` | `{ userId, socketId }` | New participant |
| `user_left` | `{ userId }` | Participant left |
| `answer_update` | `{ userId, questionId, answer }` | Peer answer update |
| `stats_update` | `{ roomId, stats }` | Live room statistics |
| `proctor_alert` | `{ roomId, userId, warning }` | Proctoring alert |
| `test_ended` | `{ roomId, testId }` | Test ended by admin |
| `new_question` | `{ questionId, question }` | New question added |

---

## 8. Environment Configuration

### 8.1 Frontend (`frontend/.env`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=NextGen Test Portal
MONGODB_URI=mongodb://localhost:27017/nextgen
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
```

### 8.2 Admin (`admin/.env.local`) — Note: Currently fixed inline in `next.config.mjs`
```env
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4000/api
NEXT_PUBLIC_ADMIN_NAME=NextGen Admin
```

### 8.3 Express Backend (`frontend/server/.env`)
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/nextgen_test_portal
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
REDIS_URL=redis://localhost:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
JWT_SECRET=your_jwt_secret_here
```

### 8.4 FastAPI Backend (`backend/backend/.env`)
```env
MONGO_URL=mongodb://localhost:27017/nextgen_test_portal_fastapi
JWT_SECRET_KEY=your_jwt_secret_here
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days
CORS_ORIGINS=["http://localhost:3001"]
ALGORITHM=HS256
```

---

## 9. Docker Configuration

### 9.1 Root `docker-compose.yml`
Services:
| Service | Build Context | Port | Description |
|---------|---------------|------|-------------|
| `web` | `frontend/` | 3000:3000 | Next.js custom server (Socket.IO + app) |
| `api` | `frontend/server/` | 4000:4000 | Express API |
| `worker` | `frontend/server/` | — | Background jobs |
| `redis` | — | 6379:6379 | Redis for queues |

### 9.2 FastAPI `docker-compose.yml` (Standalone)
Services:
| Service | Port | Description |
|---------|------|-------------|
| `api` | 8000:8000 | FastAPI backend |
| `db` | 27017:27017 | MongoDB |

### 9.3 Dockerfiles
- `frontend/Dockerfile`: Next.js app with custom server
- `frontend/server/Dockerfile`: Express backend
- `frontend/worker.Dockerfile`: Worker process
- `backend/Dockerfile`: FastAPI

---

## 10. Development Setup

### 10.1 Prerequisites
- Node.js 18+
- npm or yarn
- MongoDB (local or Atlas)
- Redis (local or cloud)
- Python 3.10+ (for FastAPI only)

### 10.2 Install Dependencies
```bash
# Express backend
cd frontend/server
npm install

# Next.js user app
cd frontend
npm install

# Admin panel
cd admin
npm install

# FastAPI (optional, standalone)
cd backend/backend
pip install -r requirements.txt
```

### 10.3 Development Scripts

#### Frontend (`frontend/package.json`)
```
npm run dev          # Start Next.js dev server
npm run dev:server   # Start Express dev server (with tsx)
npm run dev:worker   # Start worker in dev mode
npm run build        # Build production
npm run start        # Start production
npm run start:worker # Start worker
npm run lint         # Lint
tsc --noEmit         # Type check
```

#### Admin (`admin/package.json`)
```
npm run dev          # Start dev server (port 3001)
npm run build        # Build
npm run start        # Start production
npm run lint         # Lint
tsc --noEmit         # Type check
```

#### Express Backend (`frontend/server/package.json`)
```
npm run dev          # Start with tsx
npm run build        # Build
npm run start        # Start production
npm run lint         # Lint
```

#### FastAPI (`backend/backend/`)
```
uvicorn app.main:app --reload   # Dev with auto-reload
uvicorn app.main:app            # Production
```

### 10.4 Running Locally
```bash
# Terminal 1: Express backend
cd frontend/server
npm run dev

# Terminal 2: Next.js user app
cd frontend
npm run dev

# Terminal 3: Admin panel
cd admin
npm run dev

# Terminal 4: Redis
redis-server

# Terminal 5: FastAPI (standalone)
cd backend/backend
uvicorn app.main:app --reload
```

### 10.5 Running with Docker
```bash
# Main stack (user app + Express + worker + Redis)
docker-compose up -d

# FastAPI standalone
cd backend
docker-compose up -d
```

---

## 11. Testing

### 11.1 Frontend Tests
- Location: `frontend/app/__tests__/`
- Framework: Jest + React Testing Library
- Command: `cd frontend && npm test`

### 11.2 Admin Tests
- Location: `admin/__tests__/`
- Framework: Jest
- Command: `cd admin && npm test`

### 11.3 API Tests
- Location: `frontend/server/tests/`
- Framework: Jest + Supertest
- Command: `cd frontend/server && npm test`

---

## 12. Known Limitations & Issues

### 12.1 Architecture
- FastAPI backend is standalone — not integrated with admin/user frontends
- Two separate MongoDB databases (Express and FastAPI)

### 12.2 Environment Mismatches (FastAPI)
- Config expects `MONGO_URL`, compose sets `MONGO_URI`
- Config expects `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`, compose sets `ACCESS_TOKEN_EXPIRE_MINUTES`
- CORS environment format differs: Express uses comma-separated string, FastAPI uses JSON array

### 12.3 Lint Status
- Frontend: 84 pre-existing lint errors (unused vars, `no-explicit-any`, `no-unused-vars`)
- Admin: 16 pre-existing lint warnings

### 12.4 Windows Development
- CRLF line ending warnings when committing from Windows
- PowerShell command chaining requires semicolons instead of `&&`

---

## 13. Project Conventions

### 13.1 Git
- Branch: `main` on `origin/main`
- Repository: `https://github.com/TomHacker69/nextgen_test_portal.git`
- Commit style: Descriptive messages

### 13.2 Code Style
- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- 2-space indentation

### 13.3 Environment Files
- `frontend/.env` — frontend env (use `.env.example` as template)
- `backend/backend/.env` — FastAPI env (use `.env.example` as template)
- Admin config is fixed inline in `next.config.mjs` (no env file)

---

## 14. Integration Points

### 14.1 Admin ↔ Express API
- Admin app (`admin/lib/api.ts`) calls Express API endpoints
- Auth: `checkSession()` reads `res.data.user` from Express response format `{ authenticated, user }`
- Response shape: All endpoints return `{ data: ... }` or `{ data: { tests: [...] } }`

### 14.2 User App ↔ Express API
- Next.js client uses `NEXT_PUBLIC_API_URL` for API calls
- Socket.IO connects to `NEXT_PUBLIC_SOCKET_URL`
- Auth via `auth_token` cookie (HttpOnly)

### 14.3 Frontend ↔ Express Server
- `frontend/server.ts` is custom Next.js server with Socket.IO
- `frontend/lib/socketServer.ts` re-exports from `frontend/server/src/sockets/socketServer.ts`
- API routes in `frontend/app/api/` or `frontend/pages/api/` use the shared server instance

### 14.4 Express Server ↔ MongoDB
- Mongoose models: `User`, `Test`, `Question`, `TestResult`, `LiveSession`
- Connection via `MONGODB_URI`
- Config: `frontend/server/src/configs/mongo.config.ts`

### 14.5 Express Server ↔ Redis
- BullMQ queues for background jobs
- Connection via `REDIS_URL`
- Worker process: `frontend/server/src/worker.ts`

---

## 15. Deployment

### 15.1 Production Build Commands
```bash
# Frontend user app
cd frontend
npm run build && npm run start

# Admin panel
cd admin
npm run build && npm run start

# Express API
cd frontend/server
npm run build && npm run start

# Worker
cd frontend/server
npm run build && npm run start:worker

# FastAPI
cd backend/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 15.2 Docker Deployment
```bash
# All services
docker-compose up -d

# Individual services
docker-compose up -d web api worker redis
```

### 15.3 Production Considerations
- Set `NODE_ENV=production`
- Use HTTPS in production
- Set secure cookies: `secure`, `sameSite`, `httpOnly`
- Configure proper CORS origins
- Use strong JWT secrets
- Enable rate limiting
- Use MongoDB Atlas or managed MongoDB
