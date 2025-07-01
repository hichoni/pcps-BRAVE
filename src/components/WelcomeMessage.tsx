
"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { generateWelcomeMessage } from '@/ai/flows/generate-welcome-message';

export function WelcomeMessage() {
  const { user, loading: authLoading } = useAuth();
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const userStateRef = doc(db, 'userDynamicState', user.username);
    const unsubscribe = onSnapshot(userStateRef, async (docSnap) => {
      let encouragementMessage: string | null = null;
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.encouragement) {
          const now = new Date();
          const messageDate = (data.encouragement.createdAt as Timestamp).toDate();
          if ((now.getTime() - messageDate.getTime()) < 24 * 60 * 60 * 1000) {
            encouragementMessage = data.encouragement.message;
          }
        }
      }
      
      if (encouragementMessage) {
        setDisplayMessage(encouragementMessage);
        setIsLoading(false);
      } else {
        // No active encouragement, generate a welcome message
        try {
          const result = await generateWelcomeMessage({ studentName: user.name, userId: user.username });
          setDisplayMessage(result.message);
        } catch (e) {
          console.error("Failed to generate welcome message:", e);
          setDisplayMessage(`${user.name}님, 환영합니다! 오늘도 즐거운 도전을 응원해요.`);
        } finally {
          setIsLoading(false);
        }
      }
    }, (error) => {
        console.error("Error fetching welcome message state:", error);
        setDisplayMessage(`${user.name}님, 환영합니다! 오늘도 즐거운 도전을 응원해요.`);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  if (authLoading && isLoading) {
    return <Skeleton className="h-full w-full min-h-[140px]" />;
  }

  return (
    <Card className="h-full flex flex-col">
        <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <Sparkles className="w-6 h-6 text-primary"/>
            <CardTitle className="text-xl font-headline">AI 꿈-코치의 한마디</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-4">
            {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="animate-spin h-4 w-4" />
                    <span>메시지를 생성 중입니다...</span>
                </div>
            ) : displayMessage ? (
                 <p className="text-base text-center text-primary/90 font-semibold">"{displayMessage}"</p>
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
