export enum QuestionStatus {
  ANSWERED = 'ANSWERED',   // Blue
  PREMIUM = 'PREMIUM',     // Orange (Locked)
  PENDING = 'PENDING'      // White/Gray (Unanswered)
}

export interface Question {
  id: number;
  author: string;
  text: string;
  status: QuestionStatus;
  answer?: string; // Optional because pending questions have no answer
  videoUrl?: string; // Optional YouTube link
  timestamp: Date;
}