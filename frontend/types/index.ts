export type UserRole = "admin" | "user";

export type TestStatus = "scheduled" | "live" | "ended";

export type OptionKey = "a" | "b" | "c" | "d";

export interface IOption {
  key: OptionKey;
  text: string;
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
  text: string;
  options: IOption[];
  // correctOption is server-side only, excluded in client payloads
  correctOption?: OptionKey;
}

export interface ITest {
  _id: string;
  title: string;
  scheduledStartTime: string | Date;
  durationMinutes: number;
  status: TestStatus;
  questions: string[] | IQuestion[];
  roomId: string;
  createdAt?: string;
}

export interface IResponse {
  _id?: string;
  testId: string;
  userId: string;
  questionId: string;
  selectedOption: OptionKey;
  answeredAt: string | Date;
  isFinal: boolean;
}

// Live Admin Row State for virtualization
export interface ILiveParticipantRow {
  userId: string;
  name: string;
  email: string;
  roomId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  answers: Record<string, OptionKey>; // questionId -> option
  isCompleted: boolean;
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

export interface UserCompletedPayload {
  testId: string;
  userId: string;
  userName: string;
  userEmail: string;
  completedAt: string;
}
