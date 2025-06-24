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
  GOLD: 5,
  SILVER: 4,
  BRONZE: 3,
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
  { name: string; icon: LucideIcon; requirements: string; koreanName: string }
> = {
  Humanities: {
    name: 'Humanities',
    koreanName: '인문',
    icon: BookOpen,
    requirements: '지정된 필독서 중 1권 이상을 읽고 독후감을 제출하여 증명해야 합니다.',
  },
  Volunteering: {
    name: 'Volunteering',
    koreanName: '봉사',
    icon: HeartHandshake,
    requirements: '최소 10시간 이상의 봉사활동을 완료했다는 증빙 자료를 제출해야 합니다.',
  },
  'Physical Education': {
    name: 'Physical Education',
    koreanName: '체육',
    icon: Bike,
    requirements: '한 시즌 동안 스포츠팀에 참여했거나 꾸준한 신체 활동을 했다는 것을 증명해야 합니다.',
  },
  Arts: {
    name: 'Arts',
    koreanName: '예술',
    icon: Palette,
    requirements: '모든 예술 분야에서 중요한 창작물 또는 공연을 선보여야 합니다.',
  },
  Information: {
    name: 'Information',
    koreanName: '정보',
    icon: Laptop,
    requirements: '기술 관련 자격증을 취득하거나 주요 프로젝트를 완료하여 능력을 증명해야 합니다.',
  },
};
