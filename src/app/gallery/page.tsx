'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, User as UserIcon, Calendar as CalendarIcon, GalleryThumbnails } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';

interface Submission {
  id: string;
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  createdAt: Date;
  mediaUrl?: string;
  mediaType?: string;
}

const maskName = (name: string) => {
  if (name.length > 2) {
    return `${name.charAt(0)}${'*'.repeat(name.length - 2)}${name.charAt(name.length - 1)}`;
  }
  if (name.length === 2) {
    return `${name.charAt(0)}*`;
  }
  return name;
};

function GalleryCard({ submission }: { submission: Submission }) {
  const { challengeConfig } = useChallengeConfig();
  const areaConfig = challengeConfig?.[submission.areaName];
  const AreaIcon = areaConfig?.icon || UserIcon;

  return (
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300 border">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
         <Avatar>
            <AvatarFallback>{submission.userName.charAt(0)}</AvatarFallback>
         </Avatar>
         <div className="flex-grow">
            <CardTitle className="text-base font-bold">{maskName(submission.userName)} 학생</CardTitle>
            <CardDescription className="flex items-center gap-1 text-xs pt-1">
                <CalendarIcon className="w-3 h-3"/>
                {submission.createdAt ? formatDistanceToNow(submission.createdAt, { addSuffix: true, locale: ko }) : '방금 전'}
            </CardDescription>
         </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="p-3 bg-secondary/50 rounded-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <AreaIcon className="w-4 h-4" />
                <span>{submission.koreanName} - {submission.challengeName}</span>
            </div>
        </div>

        {submission.mediaUrl && submission.mediaType && (
            <div className="my-2 rounded-lg border overflow-hidden">
                {submission.mediaType.startsWith('image/') && (
                    <Image 
                        src={submission.mediaUrl}
                        alt={`${submission.koreanName} 활동 증명`}
                        width={400}
                        height={300}
                        className="w-full h-auto object-cover aspect-video"
                    />
                )}
                {submission.mediaType.startsWith('video/') && (
                    <video 
                        src={submission.mediaUrl}
                        controls
                        className="w-full aspect-video"
                    />
                )}
            </div>
        )}

        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {submission.evidence}
        </p>
      </CardContent>
    </Card>
  );
}


export default function GalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!db) {
          setLoading(false);
          return;
      };
      setLoading(true);
      try {
        const q = query(collection(db, "challengeSubmissions"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedSubmissions = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          } as Submission;
        });
        setSubmissions(fetchedSubmissions);
      } catch (error) {
        console.error("Error fetching submissions: ", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  if (authLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2">
            <GalleryThumbnails /> 도전 갤러리
        </h1>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2"/> 대시보드로
        </Button>
      </header>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({length: 3}).map((_, i) => <Card key={i} className="h-80 animate-pulse bg-muted"/>)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-semibold text-muted-foreground">아직 제출된 도전이 없어요!</p>
          <p className="text-sm text-muted-foreground">가장 먼저 도전 내용을 제출하고 갤러리를 채워보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {submissions.map(sub => <GalleryCard key={sub.id} submission={sub} />)}
        </div>
      )}
    </div>
  );
}
