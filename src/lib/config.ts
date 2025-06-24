import { BookOpen, HeartHandshake, Bike, Palette, Laptop, Award, Medal, Gem, ShieldOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const AREAS = ['Humanities', 'Volunteering', 'Physical Education', 'Arts', 'Information'] as const;
export type AreaName = (typeof AREAS)[number];

export type Achievement = {
  id: string;
  description: string;
  date: string;
  evidenceDataUri: string;
};

export type AreaState = {
  achievements: Achievement[];
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

export const AREAS_CONFIG: Record<
  AreaName,
  { name: string; icon: LucideIcon; requirements: string; koreanName: string; challengeName: string; }
> = {
  Humanities: {
    name: 'Humanities',
    koreanName: '인문',
    challengeName: '독서 마라톤 ✨',
    icon: BookOpen,
    requirements: '지정된 필독서 중 1권 이상을 읽고 독후감을 제출하여 증명해야 합니다.',
  },
  Volunteering: {
    name: 'Volunteering',
    koreanName: '봉사',
    challengeName: '탄소 줄임 실천 ♥',
    icon: HeartHandshake,
    requirements: '최소 10시간 이상의 봉사활동을 완료했다는 증빙 자료를 제출해야 합니다. (예: 탄소중립포인트 실천 활동)',
  },
  'Physical Education': {
    name: 'Physical Education',
    koreanName: '체육',
    challengeName: '건강 체력 인증',
    icon: Bike,
    requirements: '건강체력평가(PAPS) 결과에서 상위 등급을 받았거나, 한 시즌 동안 교내 스포츠팀 활동에 참여했음을 증명해야 합니다.',
  },
  Arts: {
    name: 'Arts',
    koreanName: '예술',
    challengeName: '풍풍 쇼케이스 💥',
    icon: Palette,
    requirements: '풍풍 쇼케이스 또는 교내외 예술 관련 대회/공연에 참여하여 자신의 재능을 선보여야 합니다.',
  },
  Information: {
    name: 'Information',
    koreanName: '정보',
    challengeName: '타자의 달인 •',
    icon: Laptop,
    requirements: '교내 타자 대회에서 일정 수준 이상의 성적을 거두거나, 정보 관련 자격증을 취득하여 능력을 증명해야 합니다.',
  },
};
