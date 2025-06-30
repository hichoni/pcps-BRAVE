
import { BookOpen, HeartHandshake, Bike, Palette, Laptop, Award, Medal, Gem, ShieldOff, BrainCircuit, ExternalLink, UploadCloud, FileCheck, FileX, History, Keyboard, Link } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AreaName = string;

export type Role = 'student' | 'teacher';

export interface User {
  id: number;
  username: string; // Unique identifier. e.g., 'teacher1' or 's-4-1-1'
  pin: string;
  name: string;
  role: Role;
  grade?: number;
  classNum?: number;
  studentNum?: number;
  areaName?: AreaName;
  profileAvatar?: string; // URL for custom photo, or key for predefined icon (e.g., "avatar:cat")
}

// This list now only contains teacher accounts.
// Student accounts should be added via the admin dashboard.
export const MOCK_USERS: User[] = [
    { id: 1, username: 's-4-1-1', pin: '0000', name: '김민준', role: 'student', grade: 4, classNum: 1, studentNum: 1, profileAvatar: 'avatar:rocket' },
    { id: 2, username: 's-4-1-2', pin: '0000', name: '이서연', role: 'student', grade: 4, classNum: 1, studentNum: 2, profileAvatar: 'avatar:palette' },
    { id: 3, username: 's-5-2-5', pin: '0000', name: '박서준', role: 'student', grade: 5, classNum: 2, studentNum: 5 },
    { id: 4, username: 's-6-3-10', pin: '0000', name: '최지우', role: 'student', grade: 6, classNum: 3, studentNum: 10 },
    { id: 99, username: 'master', pin: '1234', name: '마스터선생', role: 'teacher' },
    { id: 101, username: '인문', pin: '1234', name: '인문 선생님', role: 'teacher', areaName: 'Humanities' },
    { id: 102, username: '봉사', pin: '1234', name: '봉사 선생님', role: 'teacher', areaName: 'Volunteering' },
    { id: 103, username: '체육', pin: '1234', name: '체육 선생님', role: 'teacher', areaName: 'Physical-Education' },
    { id: 104, username: '예술', pin: '1234', name: '예술 선생님', role: 'teacher', areaName: 'Arts' },
    { id: 105, username: '정보', pin: '1234', name: '정보 선생님', role: 'teacher', areaName: 'Information' },
];

export type AreaState = {
  progress: number | string;
  isCertified: boolean;
};

export type AchievementsState = Record<AreaName, AreaState>;

export const CERTIFICATE_THRESHOLDS = {
  GOLD: 4,
  SILVER: 3,
  BRONZE: 2,
};

export type CertificateStatus = 'Gold' | 'Silver' | 'Bronze' | 'Unranked';

export const STATUS_CONFIG: Record<CertificateStatus, { label: string; icon: LucideIcon; color: string; }> = {
  Gold: { label: '금장', icon: Award, color: 'text-yellow-500' },
  Silver: { label: '은장', icon: Medal, color: 'text-slate-400' },
  Bronze: { label: '동장', icon: Gem, color: 'text-amber-600' },
  Unranked: { label: '미인증', icon: ShieldOff, color: 'text-gray-300' },
};

export type GoalType = 'numeric' | 'objective';
export type MediaType = 'photo' | 'video' | 'url';

export type AreaConfig = {
  name: string;
  icon: LucideIcon;
  iconName: string;
  koreanName: string;
  challengeName: string;
  requirements: string;
  placeholderText?: string;
  goalType: GoalType;
  goal: Record<string, number>; // For 'numeric' type
  options?: string[];             // For 'objective' type
  unit: string;                  // Unit for 'numeric', or a descriptive noun for 'objective'
  externalUrl?: string;
  isMediaRequired?: boolean;
  allowedMediaTypes?: MediaType[];
  autoApprove?: boolean;
  goalDescription?: string;
  showInGallery?: boolean;
  aiVisionCheck?: boolean;
  aiVisionPrompt?: string;
  submissionIntervalMinutes?: number;
  autoCertifyOn?: string[];
};

export type StoredAreaConfig = Omit<AreaConfig, 'icon' | 'name'> & { 
  externalUrl?: string;
  isMediaRequired?: boolean;
  allowedMediaTypes?: MediaType[];
  autoApprove?: boolean;
  goalDescription?: string;
  placeholderText?: string;
  showInGallery?: boolean;
  aiVisionCheck?: boolean;
  aiVisionPrompt?: string;
  submissionIntervalMinutes?: number;
  autoCertifyOn?: string[];
};

export const ICONS: Record<string, LucideIcon> = {
    BookOpen,
    HeartHandshake,
    Bike,
    Palette,
    Laptop,
    Keyboard, // New icon for typing
    BrainCircuit,
    Award,
    Medal,
    Gem,
    ExternalLink,
    UploadCloud,
    FileCheck,
    FileX,
    History,
    Link,
};

export const DEFAULT_AREAS_CONFIG: Record<AreaName, StoredAreaConfig> = {
  Humanities: {
    koreanName: '인문',
    challengeName: '독서 마라톤 ✨',
    iconName: 'BookOpen',
    requirements: '지정된 필독서 중 1권 이상을 읽고 독후감을 제출하여 증명해야 합니다.',
    placeholderText: '어떤 책을 읽고 무엇을 느꼈는지, 인상 깊었던 구절은 무엇이었는지 자유롭게 적어주세요.',
    goalType: 'numeric',
    goal: { '4': 5, '5': 5, '6': 5 },
    unit: '권',
    autoApprove: true,
    externalUrl: '',
    showInGallery: true,
    aiVisionCheck: false,
    aiVisionPrompt: '',
    submissionIntervalMinutes: 1440, // 1 day
    isMediaRequired: false,
    allowedMediaTypes: ['photo', 'video', 'url'],
  },
  Volunteering: {
    koreanName: '봉사',
    challengeName: '탄소 줄임 실천 ♥',
    iconName: 'HeartHandshake',
    requirements: '최소 10시간 이상의 봉사활동을 완료하고 활동 사진을 제출해야 합니다.',
    placeholderText: '언제, 어디서, 어떤 봉사활동을 했는지 구체적으로 작성해주세요. 활동을 통해 배우거나 느낀 점도 함께 적어주면 더욱 좋습니다.',
    goalType: 'numeric',
    goal: { '4': 10, '5': 10, '6': 10 },
    unit: '시간',
    isMediaRequired: true,
    allowedMediaTypes: ['photo', 'video', 'url'],
    autoApprove: false, // Requires photo review
    showInGallery: true,
    aiVisionCheck: false,
    aiVisionPrompt: '',
    submissionIntervalMinutes: 0,
  },
  'Physical-Education': {
    koreanName: '체육',
    challengeName: '건강 체력 인증',
    iconName: 'Bike',
    requirements: "PAPS측정 결과가 2개 요인에 1등급, 3개 요인에 2등급 이상, 또는 종합 4, 5등급인 학생이 종합 3등급 이상을 달성한 경우 인증됩니다.",
    placeholderText: '',
    goalType: 'objective',
    goal: {},
    options: ['1등급', '2등급', '3등급', '4등급', '5등급'],
    unit: '등급',
    autoCertifyOn: ['1등급', '2등급', '3등급'],
    autoApprove: false, // Teacher must check official results
    goalDescription: 'PAPS 기준 충족',
    showInGallery: false,
    aiVisionCheck: false,
    aiVisionPrompt: '',
    submissionIntervalMinutes: 0,
  },
  Arts: {
    koreanName: '예술',
    challengeName: '풍풍 쇼케이스 💥',
    iconName: 'Palette',
    requirements: '풍풍 쇼케이스 또는 교내외 예술 관련 대회/공연에 참여하고 활동 증명 자료(사진 또는 영상 URL)를 제출해야 합니다.',
    placeholderText: '언제, 어떤 대회/공연에 참여했는지 알려주세요. 작품이나 공연을 준비하며 느꼈던 점이나 특별한 경험이 있었다면 함께 공유해주세요.',
    goalType: 'numeric',
    goal: { '4': 1, '5': 1, '6': 1 },
    unit: '회 참여',
    isMediaRequired: true,
    allowedMediaTypes: ['photo', 'video', 'url'],
    autoApprove: false, // Requires review
    externalUrl: '',
    showInGallery: true,
    aiVisionCheck: false,
    aiVisionPrompt: '',
    submissionIntervalMinutes: 0,
  },
  Information: {
    koreanName: '정보',
    challengeName: 'AI 타자 연습 인증 ⌨️',
    iconName: 'Keyboard',
    requirements: "타자 연습 결과(200타 이상)를 스크린샷으로 제출하세요. AI가 자동으로 인식하여 1회 연습으로 인정해줍니다.",
    placeholderText: '타자 연습 결과 화면을 캡처하여 올려주세요. 꾸준히 연습해서 타자 실력을 높여보아요! 오늘 몇 타를 기록했는지 간단히 적어주어도 좋습니다.',
    goalType: 'numeric',
    goal: { '4': 10, '5': 15, '6': 20 },
    unit: '회',
    isMediaRequired: true,
    allowedMediaTypes: ['photo'],
    autoApprove: true,
    showInGallery: true,
    aiVisionCheck: true,
    aiVisionPrompt: `You are an AI assistant that analyzes screenshots of Korean typing tests.
Your task is to determine if the image is a typing test result and if the typing speed (타수) is 200 or greater.

1.  Analyze the provided image.
2.  Check if the image appears to be a typing test result. If not, the evidence is insufficient.
3.  Look for a number representing the typing speed, often labeled as "타수", "현재 타수", or similar. Extract this number. If you cannot find a speed, the evidence is insufficient.
4.  Compare the extracted typing speed to 200. If the speed is 200 or greater, the evidence is sufficient. Otherwise, it is not.
5.  Provide a brief, one-sentence reasoning for your decision in Korean. For example: "타자 속도(350타)가 200타 이상이므로 유효합니다." or "타자 연습 결과 이미지가 아니거나 타수를 인식할 수 없습니다."`,
    submissionIntervalMinutes: 10,
  },
};

// --- Types for Server Actions ---
export const SUBMISSION_STATUSES = ['approved', 'rejected', 'pending_review', 'pending_deletion'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];


// For submit-evidence.ts
export interface SubmitEvidenceInput {
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface SubmitEvidenceOutput {
    success: boolean;
    id: string;
    status: SubmissionStatus;
    aiReasoning: string;
    updateMessage: string;
}

// For certification-checker.ts
export interface CertificationCheckInput {
  areaName: string;
  requirements: string;
  evidence: string;
}

export interface CertificationCheckOutput {
  isSufficient: boolean;
  reasoning: string;
}

// For delete-submission.ts
export interface DeleteSubmissionInput {
  submissionId: string;
  userId: string;
}

export interface DeleteSubmissionOutput {
  success: boolean;
  message: string;
}

// For review-submission.ts
export interface ReviewSubmissionInput {
  submissionId: string;
  isApproved: boolean;
  teacherId: string;
}

export interface ReviewSubmissionOutput {
    success: boolean;
    message: string;
}

// For review-deletion-request.ts
export interface ReviewDeletionRequestInput {
  submissionId: string;
  isApproved: boolean; // approve the deletion
  teacherId: string;
}

export interface ReviewDeletionRequestOutput {
    success: boolean;
    message: string;
}

// --- Types for Feedback Flow ---
export const FEEDBACK_TYPES = ['bug', 'suggestion', 'etc'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ['new', 'viewed', 'resolved'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface Feedback {
    id: string;
    userId: string;
    userName: string;
    userRole: Role;
    type: FeedbackType;
    content: string;
    status: FeedbackStatus;
    createdAt: Date;
    reply?: string;
    repliedBy?: string;
    repliedAt?: Date;
}

export interface SubmitFeedbackInput {
    userId: string;
    userName: string;
    userRole: Role;
    type: FeedbackType;
    content: string;
}

export interface SubmitFeedbackOutput {
    success: boolean;
    id: string;
}

export interface UpdateFeedbackInput {
    feedbackId: string;
    status: FeedbackStatus;
    reply: string;
    teacherId: string;
    teacherName: string;
}

export interface UpdateFeedbackOutput {
    success: boolean;
    message: string;
}
