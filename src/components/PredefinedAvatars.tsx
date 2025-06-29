
import React from 'react';
import {
  Trophy, Award, Medal, Rocket, Target, Flag, Flame, Book, Brain, Palette, Music, Bike, Dumbbell, Heart, Sparkles, GraduationCap, Lightbulb, Mountain, TreePine, Atom
} from 'lucide-react';

export const AVATAR_OPTIONS = [
  { key: 'avatar:trophy', name: '트로피', component: () => <Trophy /> },
  { key: 'avatar:award', name: '상장', component: () => <Award /> },
  { key: 'avatar:medal', name: '메달', component: () => <Medal /> },
  { key: 'avatar:rocket', name: '로켓', component: () => <Rocket /> },
  { key: 'avatar:target', name: '과녁', component: () => <Target /> },
  { key: 'avatar:flag', name: '깃발', component: () => <Flag /> },
  { key: 'avatar:flame', name: '불꽃', component: () => <Flame /> },
  { key: 'avatar:book', name: '책', component: () => <Book /> },
  { key: 'avatar:brain', name: '두뇌', component: () => <Brain /> },
  { key: 'avatar:palette', name: '팔레트', component: () => <Palette /> },
  { key: 'avatar:music', name: '음표', component: () => <Music /> },
  { key: 'avatar:bike', name: '자전거', component: () => <Bike /> },
  { key: 'avatar:dumbbell', name: '아령', component: () => <Dumbbell /> },
  { key: 'avatar:heart', name: '하트', component: () => <Heart /> },
  { key: 'avatar:sparkles', name: '반짝이', component: () => <Sparkles /> },
  { key: 'avatar:graduationCap', name: '학사모', component: () => <GraduationCap /> },
  { key: 'avatar:lightbulb', name: '전구', component: () => <Lightbulb /> },
  { key: 'avatar:mountain', name: '산', component: () => <Mountain /> },
  { key: 'avatar:treePine', name: '소나무', component: () => <TreePine /> },
  { key: 'avatar:atom', name: '원자', component: () => <Atom /> },
];
