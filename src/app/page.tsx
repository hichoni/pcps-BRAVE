"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dashboard } from '@/components/Dashboard';
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!loading && isClient) {
      if (!user) {
        router.push('/login');
      } else if (user.role === 'student' && user.pin === '0000') {
        router.push('/change-pin');
      } else if (user.role === 'teacher') {
        router.push('/admin');
      }
    }
  }, [user, loading, router, isClient]);

  if (!isClient || loading || !user || (user.role === 'student' && user.pin === '0000') || user.role === 'teacher') {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user.role === 'student') {
    return <Dashboard />;
  }
  
  return null;
}
