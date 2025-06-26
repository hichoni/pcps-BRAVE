import { BookOpen, HeartHandshake, Bike, Palette, Laptop, Award, Medal, Gem, ShieldOff, BrainCircuit, ExternalLink, UploadCloud, FileCheck, FileX, History } from 'lucide-react';
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
}

export const MOCK_USERS: User[] = [
    { id: 1, username: 'master-teacher', pin: '1234', name: '김선생', role: 'teacher' },
    { id: 99, username: 'master', pin: '1234', name: '마스터선생', role: 'teacher' },
    { id: 101, username: '인문', pin: '1234', name: '인문 선생님', role: 'teacher', areaName: 'Humanities' },
    { id: 102, username: '봉사', pin: '1234', name: '봉사 선생님', role: 'teacher', areaName: 'Volunteering' },
    { id: 103, username: '체육', pin: '1234', name: '체육 선생님', role: 'teacher', areaName: 'Physical-Education' },
    { id: 104, username: '예술', pin: '1234', name: '예술 선생님', role: 'teacher', areaName: 'Arts' },
    { id: 105, username: '정보', pin: '1234', name: '정보 선생님', role: 'teacher', areaName: 'Information' },
    { id: 11, username: 's-4-1-1', pin: '0000', name: '김철수', role: 'student', grade: 4, classNum: 1, studentNum: 1 },
    { id: 12, username: 's-4-1-2', pin: '1111', name: '이영희', role: 'student', grade: 4, classNum: 1, studentNum: 2 },
    { id: 13, username: 's-5-2-3', pin: '0000', name: '박바둑', role: 'student', grade: 5, classNum: 2, studentNum: 3 },
    { id: 14, username: 's-5-2-4', pin: '1111', name: '최미미', role: 'student', grade: 5, classNum: 2, studentNum: 4 },
    { id: 15, username: 's-6-1-5', pin: '1111', name: '강현우', role: 'student', grade: 6, classNum: 1, studentNum: 5 },
    { id: 16, username: 's-4-1-111', pin: '0000', name: '홍길동', role: 'student', grade: 4, classNum: 1, studentNum: 111 },
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

export const STATUS_CONFIG: Record<CertificateStatus, { label: string; icon: LucideIcon; color: string }> = {
  Gold: { label: '금장', icon: Award, color: 'text-yellow-400' },
  Silver: { label: '은장', icon: Medal, color: 'text-gray-400' },
  Bronze: { label: '동장', icon: Gem, color: 'text-orange-400' },
  Unranked: { label: '미해당', icon: ShieldOff, color: 'text-muted-foreground' },
};

export type GoalType = 'numeric' | 'objective';

export type AreaConfig = {
  name: string;
  icon: LucideIcon;
  koreanName: string;
  challengeName: string;
  requirements: string;
  goalType: GoalType;
  goal: Record<string, number>; // For 'numeric' type
  options?: string[];             // For 'objective' type
  unit: string;                  // Unit for 'numeric', or a descriptive noun for 'objective'
  externalUrl?: string;
  mediaRequired?: boolean;
  autoApprove?: boolean;
  goalDescription?: string;
};

export type StoredAreaConfig = Omit<AreaConfig, 'icon' | 'name'> & { 
  iconName: string;
  externalUrl?: string;
  mediaRequired?: boolean;
  autoApprove?: boolean;
  goalDescription?: string;
};

export const ICONS: Record<string, LucideIcon> = {
    BookOpen,
    HeartHandshake,
    Bike,
    Palette,
    Laptop,
    BrainCircuit,
    Award,
    Medal,
    Gem,
    ExternalLink,
    UploadCloud,
    FileCheck,
    FileX,
    History,
};

export const DEFAULT_AREAS_CONFIG: Record<AreaName, StoredAreaConfig> = {
  Humanities: {
    koreanName: '인문',
    challengeName: '독서 마라톤 ✨',
    iconName: 'BookOpen',
    requirements: '지정된 필독서 중 1권 이상을 읽고 독후감을 제출하여 증명해야 합니다.',
    goalType: 'numeric',
    goal: { '4': 5, '5': 5, '6': 5 },
    unit: '권',
    autoApprove: true,
    externalUrl: '',
  },
  Volunteering: {
    koreanName: '봉사',
    challengeName: '탄소 줄임 실천 ♥',
    iconName: 'HeartHandshake',
    requirements: '최소 10시간 이상의 봉사활동을 완료하고 활동 사진을 제출해야 합니다.',
    goalType: 'numeric',
    goal: { '4': 10, '5': 10, '6': 10 },
    unit: '시간',
    mediaRequired: true,
    autoApprove: false, // Requires photo review
  },
  'Physical-Education': {
    koreanName: '체육',
    challengeName: '건강 체력 인증',
    iconName: 'Bike',
    requirements: "PAPS측정 결과가 2개 요인에 1등급, 3개 요인에 2등급 이상, 또는 종합 4, 5등급인 학생이 종합 3등급 이상을 달성한 경우 인증됩니다.",
    goalType: 'objective',
    goal: {},
    options: ['1등급', '2등급', '3등급', '4등급', '5등급'],
    unit: '등급',
    autoApprove: false, // Teacher must check official results
    goalDescription: 'PAPS 기준 충족',
  },
  Arts: {
    koreanName: '예술',
    challengeName: '풍풍 쇼케이스 💥',
    iconName: 'Palette',
    requirements: '풍풍 쇼케이스 또는 교내외 예술 관련 대회/공연에 참여하고 활동 사진을 제출해야 합니다.',
    goalType: 'numeric',
    goal: { '4': 1, '5': 1, '6': 1 },
    unit: '회 참여',
    mediaRequired: true,
    autoApprove: false, // Requires photo/video review
    externalUrl: '',
  },
  Information: {
    koreanName: '정보',
    challengeName: '타자의 달인 •',
    iconName: 'Laptop',
    requirements: "교내 타자 대회에서 '달인' 등급을 달성해야 합니다.",
    goalType: 'objective',
    goal: {},
    options: ['입문', '초보', '중수', '고수', '달인'],
    unit: '레벨',
    autoApprove: false, // Teacher must check official results
    goalDescription: "'달인' 등급",
  },
};

// --- Types for Server Actions ---
export type SubmissionStatus = 'approved' | 'rejected' | 'pending_review';

// For submit-evidence.ts
export interface SubmitEvidenceInput {
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  mediaDataUri?: string;
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
