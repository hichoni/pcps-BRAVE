
import React from 'react';

const CatAvatar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 0-3.5 19.5A10 10 0 0 0 12 2z" />
    <path d="M12 10c-1.5 0-3 1-3 2.5 0 1.5 1.5 2.5 3 2.5s3-1 3-2.5c0-1.5-1.5-2.5-3-2.5z" />
    <path d="M9 8.5c.5-.5 1.5-1 2-1s1.5.5 2 1" />
    <path d="M15 8.5c-.5-.5-1.5-1-2-1s-1.5.5-2 1" />
  </svg>
);

const DogAvatar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4c-4 0-8 4-8 8s4 8 8 8 8-4 8-8-4-8-8-8z" />
    <path d="M12 12c-1.5 0-3 1-3 2.5S10.5 17 12 17s3-1 3-2.5S13.5 12 12 12z" />
    <path d="M9 10v.01" />
    <path d="M15 10v.01" />
  </svg>
);

const BearAvatar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
        <path d="M8.5 9.5a1 1 0 100-2 1 1 0 000 2z" />
        <path d="M15.5 9.5a1 1 0 100-2 1 1 0 000 2z" />
        <path d="M12 16a3 3 0 00-3-3h6a3 3 0 00-3 3z" />
    </svg>
);

const RobotAvatar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r=".5" />
        <circle cx="15.5" cy="8.5" r=".5" />
        <path d="M9 14h6" />
    </svg>
);

const FoxAvatar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l8 8-8 8-8-8 8-8z" />
        <path d="M12 10a2 2 0 100-4 2 2 0 000 4z" />
        <path d="M12 22v-6" />
    </svg>
);

const StarAvatar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.25l-6.18 3.77L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
);


export const AVATAR_OPTIONS = [
  { key: 'avatar:cat', name: '고양이', component: CatAvatar },
  { key: 'avatar:dog', name: '강아지', component: DogAvatar },
  { key: 'avatar:bear', name: '곰', component: BearAvatar },
  { key: 'avatar:robot', name: '로봇', component: RobotAvatar },
  { key: 'avatar:fox', name: '여우', component: FoxAvatar },
  { key: 'avatar:star', name: '별', component: StarAvatar },
];
