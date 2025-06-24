import { BookOpen, HeartHandshake, Bike, Palette, Laptop, Award, Medal, Gem, ShieldOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const AREAS = ['Humanities', 'Volunteering', 'Physical Education', 'Arts', 'Information'] as const;
export type AreaName = (typeof AREAS)[number];

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
}

export const MOCK_USERS: User[] = [
    { id: 1, username: 'teacher1', pin: '1234', name: '김선생', role: 'teacher' },
    { id: 2, username: 'teacher2', pin: '1234', name: '이선생', role: 'teacher' },
    { id: 11, username: 's-4-1-1', pin: '0000', name: '김철수', role: 'student', grade: 4, classNum: 1, studentNum: 1 },
    { id: 12, username: 's-4-1-2', pin: '1111', name: '이영희', role: 'student', grade: 4, classNum: 1, studentNum: 2 },
    { id: 13, username: 's-5-2-3', pin: '0000', name: '박바둑', role: 'student', grade: 5, classNum: 2, studentNum: 3 },
    { id: 14, username: 's-5-2-4', pin: '1111', name: '최미미', role: 'student', grade: 5, classNum: 2, studentNum: 4 },
    { id: 15, username: 's-6-1-5', pin: '1111', name: '강현우', role: 'student', grade: 6, classNum: 1, studentNum: 5 },
    { id: 16, username: 's-4-1-111', pin: '0000', name: '홍길동', role: 'student', grade: 4, classNum: 1, studentNum: 111 },
];

export type AreaState = {
  progress: number;
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

type AreaConfig = {
  name: string;
  icon: LucideIcon;
  requirements: string;
  koreanName: string;
  challengeName: string;
  goal: number;
  unit: string;
};

export const AREAS_CONFIG: Record<AreaName, AreaConfig> = {
  Humanities: {
    name: 'Humanities',
    koreanName: '인문',
    challengeName: '독서 마라톤 ✨',
    icon: BookOpen,
    requirements: '지정된 필독서 중 1권 이상을 읽고 독후감을 제출하여 증명해야 합니다.',
    goal: 5,
    unit: '권',
  },
  Volunteering: {
    name: 'Volunteering',
    koreanName: '봉사',
    challengeName: '탄소 줄임 실천 ♥',
    icon: HeartHandshake,
    requirements: '최소 10시간 이상의 봉사활동을 완료했다는 증빙 자료를 제출해야 합니다. (예: 탄소중립포인트 실천 활동)',
    goal: 10,
    unit: '시간',
  },
  'Physical Education': {
    name: 'Physical Education',
    koreanName: '체육',
    challengeName: '건강 체력 인증',
    icon: Bike,
    requirements: '건강체력평가(PAPS) 결과에서 상위 등급을 받았거나, 한 시즌 동안 교내 스포츠팀 활동에 참여했음을 증명해야 합니다.',
    goal: 2,
    unit: '등급',
  },
  Arts: {
    name: 'Arts',
    koreanName: '예술',
    challengeName: '풍풍 쇼케이스 💥',
    icon: Palette,
    requirements: '풍풍 쇼케이스 또는 교내외 예술 관련 대회/공연에 참여하여 자신의 재능을 선보여야 합니다.',
    goal: 1,
    unit: '회 참여',
  },
  Information: {
    name: 'Information',
    koreanName: '정보',
    challengeName: '타자의 달인 •',
    icon: Laptop,
    requirements: '교내 타자 대회에서 일정 수준 이상의 성적을 거두거나, 정보 관련 자격증을 취득하여 능력을 증명해야 합니다.',
    goal: 300,
    unit: '타',
  },
};
