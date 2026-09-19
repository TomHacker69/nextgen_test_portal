/**
 * @nextgen/shared-types
 *
 * SINGLE SOURCE OF TRUTH for every domain shape and Socket.IO event contract.
 *
 * Every workspace (apps/user, apps/admin, server, worker) imports from here.
 * Do NOT redeclare ITest / IQuestion / IUser / payload types anywhere else.
 * Changing any event payload interface here breaks the build of every consumer,
 * which is exactly the guarantee we want (prevents drift like the old
 * `scheduledEndTime` vs `durationMinutes` mismatch).
 */

export type UserRole = "admin" | "user";

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name?: string;
  roomId?: string;
  mustChangePassword?: boolean;
}

export type TestStatus = "scheduled" | "live" | "ended";

export type QuestionType = "mcq" | "coding";

export type CodingLanguage = "javascript" | "python" | "cpp" | "java";

export type OptionKey = "a" | "b" | "c" | "d";

export interface IOption {
  key: OptionKey;
  text: string;
}

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface IExecutionResult {
  testCaseIndex: number;
  passed: boolean;
  actualOutput: string;
  stderr: string;
  executionTimeMs: number;
}

export interface IAdmin {
  _id: string;
  email: string;
  role: "admin";
  passwordHash?: string;
  createdAt?: string;
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  roomId: string;
  role?: "user";
  createdAt?: string;
}

export interface IQuestion {
  _id: string;
  testId: string;
  order: number;
  type: QuestionType;
  text: string;
  // MCQ fields
  options?: IOption[];
  correctOption?: OptionKey; // server-side only
  // Coding fields
  language?: CodingLanguage;
  starterCode?: string;
  testCases?: ITestCase[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
}

/**
 * Canonical test shape.
 *
 * Duration is modelled purely as `durationMinutes` (relative). The absolute end
 * time is ALWAYS derived at runtime as `scheduledStartTime + durationMinutes`.
 * There is no stored `scheduledEndTime` field anywhere in the system.
 */
export interface ITest {
  _id: string;
  title: string;
  scheduledStartTime: string | Date;
  durationMinutes: number;
  defaultPassword?: string;
  status: TestStatus;
  questions: string[] | IQuestion[];
  roomId: string;
  createdAt?: string;
}

export interface IUserTestAccess {
  _id?: string;
  testId: string;
  userId: string;
  extraMinutes: number;
  blocked: boolean;
  personalEndTime: string | Date;
  status: "not_started" | "in_progress" | "completed" | "blocked";
  lastSeenQuestionIndex: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICodeSnapshot {
  _id?: string;
  testId: string;
  userId: string;
  questionId: string;
  code: string;
  language: string;
  capturedAt: string | Date;
}

export interface IResponse {
  _id?: string;
  testId: string;
  userId: string;
  questionId: string;
  // MCQ fields
  selectedOption?: OptionKey;
  answeredAt: string | Date;
  isFinal: boolean;
  // Coding fields
  finalCode?: string;
  executionResults?: IExecutionResult[];
  score?: number;
}

// Live Admin Row State for virtualization with coding drilldown and grading status
export interface ILiveParticipantRow {
  userId: string;
  name: string;
  email: string;
  roomId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  answers: Record<string, OptionKey>;
  codeSnapshots: Record<string, { code: string; language: string; capturedAt: string }>;
  gradingStatus: Record<string, "idle" | "grading" | "graded">;
  scores: Record<string, number>;
  isCompleted: boolean;
  blocked: boolean;
  extraMinutes: number;
  personalEndTime: string;
  lastAnsweredAt?: string;
  isOnline: boolean;
}

// ---------------------------------------------------------------------------
// Socket.IO event contract
// ---------------------------------------------------------------------------
// Typed event maps consumed by the server (@nextgen/server) and both frontends.
// The server MUST emit on `ServerToClientEvents` names and the clients MUST
// only listen for those names; likewise the clients emit on
// `ClientToServerEvents` names and must provide the matching payload shape.
// Because these are shared types, any shape change is caught at compile time
// in every consumer.

export interface ClientToServerEvents {
  // Users
  "answer:submit": (payload: ClientSubmitAnswerPayload) => void;
  "code:snapshot": (payload: ClientCodeSnapshotPayload) => void;
  "code:submit": (payload: ClientSubmitCodePayload) => void;
  "user:completed": (payload: UserCompletedPayload) => void;
  // Admins
  "admin:join": (testId: string) => void;
  "admin:leave": (testId: string) => void;
}

export interface ServerToClientEvents {
  "test:started": (payload: TestStartedEvent) => void;
  "code:evaluated": (payload: CodeEvaluatedEvent) => void;
  "admin:update": (payload: AdminLiveUpdatePayload) => void;
  "admin:codeUpdate": (payload: AdminCodeUpdatePayload) => void;
  "admin:codeGraded": (payload: CodeEvaluatedEvent) => void;
  "admin:gradingQueued": (payload: AdminGradingQueuedPayload) => void;
  "admin:userBlocked": (payload: UserBlockedEvent) => void;
  "admin:timeExtended": (payload: AdminTimeExtendedPayload) => void;
  "admin:testLive": (payload: AdminTestLivePayload) => void;
  "test:autoSubmitted": (payload: TestAutoSubmittedEvent) => void;
  "time:extended": (payload: UserTimeExtendedPayload) => void;
  "user:completed": (payload: UserCompletedPayload) => void;
  "error:blocked": (payload: { message: string }) => void;
}

// --- Client -> Server payload types ---
export interface ClientSubmitAnswerPayload {
  testId: string;
  questionId: string;
  selectedOption: OptionKey;
  questionIndex: number;
}

export interface ClientCodeSnapshotPayload {
  testId: string;
  questionId: string;
  code: string;
  language: CodingLanguage;
}

export interface ClientSubmitCodePayload {
  testId: string;
  questionId: string;
  code: string;
  language: CodingLanguage;
  questionIndex: number;
}

// --- Server -> Client (admin stream) event payloads ---
export interface AdminLiveUpdatePayload {
  testId: string;
  userId: string;
  userName: string;
  userEmail: string;
  questionId: string;
  questionIndex: number;
  selectedOption: OptionKey;
  answeredAt: string;
  isFinal?: boolean;
}

export interface AdminCodeUpdatePayload {
  testId: string;
  userId: string;
  userName: string;
  userEmail: string;
  questionId: string;
  code: string;
  language: string;
  capturedAt: string;
}

export interface AdminGradingQueuedPayload {
  testId: string;
  userId: string;
  questionId: string;
  questionIndex: number;
  jobId: string;
  queuedAt: string;
}

export interface AdminCodeGradedPayload {
  jobId: string;
  testId: string;
  userId: string;
  questionId: string;
  isSampleRun: boolean;
  executionResults: IExecutionResult[];
  score: number;
  userName?: string;
  completedAt?: string;
}

export interface CodeEvaluatedEvent {
  jobId?: string;
  testId: string;
  userId: string;
  questionId: string;
  questionIndex?: number;
  isSampleRun?: boolean;
  executionResults?: IExecutionResult[];
  passedCount?: number;
  totalCount?: number;
  score: number;
  userName?: string;
  completedAt?: string;
}

export interface UserBlockedEvent {
  testId: string;
  userId: string;
  reason?: string;
  blockedAt?: string;
}

export interface AdminTestLivePayload {
  testId: string;
}

export interface AdminTimeExtendedPayload {
  testId: string;
  userId: string;
  extraMinutes: number;
  personalEndTime: string;
}

export interface UserTimeExtendedPayload {
  testId: string;
  userId: string;
  extraMinutes: number;
  addedMinutes: number;
  personalEndTime: string;
}

export interface TestStartedEvent {
  testId: string;
  roomId: string;
  startedAt: string;
}

export interface TestAutoSubmittedEvent {
  testId: string;
  message: string;
}

// Re-export so the worker (which only needs the job result type) can import
// the full contract without reaching into server internals.
export interface UserCompletedPayload {
  testId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  autoSubmitted?: boolean;
  completedAt: string;
}

export interface TimeExtendedPayload {
  testId: string;
  userId: string;
  extraMinutes: number;
  personalEndTime: string;
}

export interface UserBlockedPayload {
  testId: string;
  userId: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Sandbox / code-execution job contract
// Reused by the API server (enqueue) and the sandbox worker (processing).
// ---------------------------------------------------------------------------
export interface CodeExecutionJobData {
  jobId: string;
  testId: string;
  userId: string;
  userName?: string;
  questionId: string;
  code: string;
  language: CodingLanguage;
  isSampleRun: boolean;
  testCases: ITestCase[];
  timeLimitMs?: number;
  memoryLimitKb?: number;
}

export interface CodeExecutionJobResult {
  jobId: string;
  testId: string;
  userId: string;
  questionId: string;
  isSampleRun: boolean;
  executionResults: IExecutionResult[];
  score: number;
}
