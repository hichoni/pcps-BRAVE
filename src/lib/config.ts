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
    requirements: 'Submit proof of reading and writing a report on at least one approved book.',
  },
  Volunteering: {
    name: 'Volunteering',
    koreanName: '봉사',
    icon: HeartHandshake,
    requirements: 'Provide evidence of completing at least 10 hours of community service.',
  },
  'Physical Education': {
    name: 'Physical Education',
    koreanName: '체육',
    icon: Bike,
    requirements: 'Document participation in a sports team or a consistent physical activity for a season.',
  },
  Arts: {
    name: 'Arts',
    koreanName: '예술',
    icon: Palette,
    requirements: 'Showcase a significant creative work or performance in any artistic medium.',
  },
  Information: {
    name: 'Information',
    koreanName: '정보',
    icon: Laptop,
    requirements: 'Demonstrate proficiency by earning a technology-related certificate or completing a major project.',
  },
};
