
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

interface Encouragement {
    message: string;
    createdAt: Timestamp;
}

export function WelcomeMessage() {
  const { user, loading: authLoading } = useAuth();
  const [encouragement, setEncouragement] = useState<Encouragement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !db) {
        setLoading(false);
        return;
    }

    const userStateRef = doc(db, 'userDynamicState', user.username);
    const unsubscribe = onSnapshot(userStateRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.encouragement) {
          const now = new Date();
          const messageDate = (data.encouragement.createdAt as Timestamp).toDate();
          if ((now.getTime() - messageDate.getTime()) < 24 * 60 * 60 * 1000) {
            setEncouragement(data.encouragement as Encouragement);
          } else {
            setEncouragement(null);
          }
        } else {
            setEncouragement(null);
        }
      } else {
        setEncouragement(null);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching welcome message:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  if (loading) {
    return <Skeleton className="h-full w-full min-h-[140px]" />;
  }
  
  return (
    <Card className="h-full flex flex-col">
        <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <Sparkles className="w-6 h-6 text-primary"/>
            <CardTitle className="text-xl font-headline">AI의 응원 메시지</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-4">
            {encouragement ? (
                 <p className="text-base text-center text-primary/90 font-semibold">"{encouragement.message}"</p>
            ) : (
                <p className="text-base text-center text-muted-foreground">
                    {user?.name}님, 환영합니다!
                    <br/>
                    오늘도 즐거운 도전을 응원해요.
                </p>
            )}
        </CardContent>
    </Card>
  );
}
