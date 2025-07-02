"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, Timestamp, setDoc } from 'firebase/firestore';
import { isToday } from 'date-fns';
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

    // Using onSnapshot to react to changes (e.g., new encouragement message)
    const unsubscribe = onSnapshot(userStateRef, async (docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : {};
      
      // 1. Check for high-priority, fresh encouragement message
      if (data.encouragement) {
        const messageDate = (data.encouragement.createdAt as Timestamp).toDate();
        // Show encouragement if it's from today
        if (isToday(messageDate)) {
          setDisplayMessage(data.encouragement.message);
          setIsLoading(false);
          return; // High-priority message shown, we're done.
        }
      }
      
      // 2. Check for existing welcome message for today
      if (data.welcomeMessage) {
        const messageDate = (data.welcomeMessage.createdAt as Timestamp).toDate();
        if (isToday(messageDate)) {
          setDisplayMessage(data.welcomeMessage.message);
          setIsLoading(false);
          return; // Welcome message for today already exists
        }
      }

      // 3. Generate a new welcome message if none of the above are met
      try {
        const result = await generateWelcomeMessage({ studentName: user.name, userId: user.username });
        const newMessage = result.message;
        setDisplayMessage(newMessage);
        
        // Save the newly generated message to Firestore so it's not generated again today
        await setDoc(userStateRef, {
          welcomeMessage: {
            message: newMessage,
            createdAt: Timestamp.now(),
          }
        }, { merge: true });

      } catch (e) {
        console.error("Failed to generate welcome message:", e);
        const fallbackMessage = `${user.name}님, 환영합니다! 오늘도 즐거운 도전을 응원해요.`;
        setDisplayMessage(fallbackMessage);
      } finally {
        setIsLoading(false);
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
    <Card className="h-full flex flex-col bg-primary text-primary-foreground">
        <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
            <Sparkles className="w-6 h-6 text-primary-foreground"/>
            <CardTitle className="text-xl font-headline">AI 꿈-코치의 한마디</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-4">
            {isLoading ? (
                <div className="flex items-center gap-2 text-primary-foreground/80">
                    <Loader2 className="animate-spin h-4 w-4" />
                    <span>메시지를 생성 중입니다...</span>
                </div>
            ) : displayMessage ? (
                 <p className="text-base text-center text-primary-foreground font-semibold">"{displayMessage}"</p>
            ) : (
                <p className="text-base text-center text-primary-foreground/80">
                    {user?.name}님, 환영합니다!
                    <br/>
                    오늘도 즐거운 도전을 응원해요.
                </p>
            )}
        </CardContent>
    </Card>
  );
}
