export type UserRole = "admin" | "user";

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
  answers: Record<string, OptionKey>; // questionId -> option
  codeSnapshots: Record<string, { code: string; language: string; capturedAt: string }>; // questionId -> snapshot
  gradingStatus: Record<string, "idle" | "grading" | "graded">;
  scores: Record<string, number>; // questionId -> score
  isCompleted: boolean;
  blocked: boolean;
  extraMinutes: number;
  personalEndTime: string;
  lastAnsweredAt?: string;
  isOnline: boolean;
}

// Socket Payload Types
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
  language: string;
}

export interface ClientSubmitCodePayload {
  testId: string;
  questionId: string;
  code: string;
  language: string;
  questionIndex: number;
}

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

export interface UserCompletedPayload {
  testId: string;
  userId: string;
  userName: string;
  userEmail: string;
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
