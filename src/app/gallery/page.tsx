
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, User } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { Loader2, ArrowLeft, User as UserIcon, Calendar as CalendarIcon, GalleryThumbnails, Trash2, Heart, Search, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteSubmission } from '@/ai/flows/delete-submission';
import { toggleLike } from '@/ai/flows/toggle-like';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EditSubmissionDialog } from '@/components/EditSubmissionDialog';
import { SubmissionStatus } from '@/lib/config';


interface Submission {
  id: string;
  userId: string;
  userName: string;
  areaName: string;
  koreanName: string;
  challengeName: string;
  evidence: string;
  createdAt: Date;
  status: SubmissionStatus;
  mediaUrl?: string;
  mediaType?: string;
  likes: string[];
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

function GalleryCard({ submission, user, onSubmissionDeleted, onSubmissionUpdated }: { submission: Submission; user: User | null, onSubmissionDeleted: (id: string) => void, onSubmissionUpdated: (updatedSubmission: {id: string; evidence: string}) => void }) {
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  const AreaIcon = challengeConfig?.[submission.areaName]?.icon || UserIcon;

  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isLiked, setIsLiked] = useState(user ? submission.likes.includes(user.username) : false);
  const [likeCount, setLikeCount] = useState(submission.likes.length);
  const [isEditing, setIsEditing] = useState(false);
  
  const isOwner = user?.username === submission.userId;
  const canManage = user && (isOwner || user.role === 'teacher');
  const isPending = submission.status === 'pending_deletion' || submission.status === 'pending_review';

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const result = await deleteSubmission({ submissionId: submission.id, userId: String(user.id) });
      toast({ title: '처리 완료', description: result.message });
      // If a teacher deletes, it's gone immediately. If a student requests, it stays but status changes.
      // The parent component will get the status update via real-time listener.
      // We only need to remove it from view if the actor was a teacher.
      if (user.role === 'teacher') {
        onSubmissionDeleted(submission.id);
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '처리 오류', description: error.message || '게시글 삭제/요청 중 오류가 발생했습니다.' });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!user || isLiking) return;
    
    setIsLiking(true);

    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;

    setIsLiked(!originalIsLiked);
    setLikeCount(originalIsLiked ? originalLikeCount - 1 : originalLikeCount + 1);

    try {
      const result = await toggleLike({ submissionId: submission.id, userId: user.username });
      setIsLiked(result.isLiked);
      setLikeCount(result.newLikeCount);
    } catch (error: any) {
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
      toast({ variant: 'destructive', title: '오류', description: error.message || '좋아요 처리 중 오류가 발생했습니다.' });
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <>
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
         {canManage && (
           <div className="flex items-center gap-1">
            {user.role === 'teacher' && (
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4" />
                </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={isDeleting || isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {user.role === 'teacher' ? "정말로 삭제하시겠습니까?" : "정말로 삭제를 요청하시겠습니까?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {user.role === 'teacher' 
                        ? "이 게시글을 삭제하면 되돌릴 수 없습니다. 갤러리에서 영구적으로 사라집니다." 
                        : "이 게시물의 삭제를 요청합니다. 요청이 승인되면, 게시물과 관련 진행도가 영구적으로 삭제되며 되돌릴 수 없습니다."
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (user.role === 'teacher' ? '삭제' : '삭제 요청')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
           </div>
         )}
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
      <CardFooter className="flex justify-start items-center p-4 pt-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          disabled={isLiking || !user}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-rose-500 px-2"
        >
          <Heart className={cn("h-5 w-5 transition-all", isLiked ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground')} />
          <span className="font-semibold text-sm">{likeCount}</span>
        </Button>
      </CardFooter>
    </Card>
    <EditSubmissionDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        submission={submission}
        onSubmissionUpdated={onSubmissionUpdated}
    />
    </>
  );
}


export default function GalleryPage() {
  const { user, users, loading: authLoading, usersLoading } = useAuth();
  const { challengeConfig, loading: configLoading } = useChallengeConfig();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 9;

  const [gradeFilter, setGradeFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchInitialSubmissions = async () => {
      if (!db || !user || !challengeConfig || configLoading) {
          setLoadingInitial(false);
          return;
      };
      setLoadingInitial(true);
      try {
        const q = query(
            collection(db, "challengeSubmissions"), 
            where("showInGallery", "==", true),
            where("status", "==", "approved"),
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE)
        );
        const querySnapshot = await getDocs(q);
        const fetchedSubmissions = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
            likes: data.likes || [],
          } as Submission;
        });
        setSubmissions(fetchedSubmissions);
        
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastDoc(lastVisible);
        setHasMore(querySnapshot.docs.length === PAGE_SIZE);

      } catch (error) {
        console.error("Error fetching submissions: ", error);
      } finally {
        setLoadingInitial(false);
      }
    };

    if (user && !configLoading) {
      fetchInitialSubmissions();
    }
  }, [user, configLoading, challengeConfig]);

  useEffect(() => {
    if (gradeFilter !== 'all') {
      setClassFilter('all');
    }
  }, [gradeFilter]);
  
  const fetchMoreSubmissions = async () => {
    if (!db || !lastDoc || !hasMore || loadingMore) return;
    
    setLoadingMore(true);
    try {
        const q = query(
            collection(db, "challengeSubmissions"),
            where("showInGallery", "==", true),
            where("status", "==", "approved"),
            orderBy("createdAt", "desc"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
        );
        const querySnapshot = await getDocs(q);
        const newSubmissions = querySnapshot.docs.map(doc => {
             const data = doc.data();
             return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
                likes: data.likes || [],
            } as Submission;
        });

        setSubmissions(prev => [...prev, ...newSubmissions]);
        
        const lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        setLastDoc(lastVisible);
        setHasMore(querySnapshot.docs.length === PAGE_SIZE);

    } catch (error) {
        console.error("Error fetching more submissions: ", error);
    } finally {
        setLoadingMore(false);
    }
  };

  const handleSubmissionDeleted = useCallback((deletedId: string) => {
    setSubmissions(prev => prev.filter(s => s.id !== deletedId));
  }, []);
  
  const handleSubmissionUpdated = useCallback((updatedSubmission: {id: string; evidence: string}) => {
    setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? { ...s, evidence: updatedSubmission.evidence } : s));
  }, []);

  const allStudentUsers = users.filter(u => u.role === 'student');
  const availableGrades = [...new Set(allStudentUsers.map(u => u.grade))].sort((a,b) => (a ?? 0) - (b ?? 0));
  const studentsForClassList = allStudentUsers.filter(u => gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10));
  const availableClasses = [...new Set(studentsForClassList.map(u => u.classNum))].sort((a,b) => (a ?? 0) - (b ?? 0));
  
  const userMap = useMemo(() => new Map(users.map(u => [u.username, u])), [users]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(submission => {
        const author = userMap.get(submission.userId);
        if (!author) return false;

        const gradeMatch = gradeFilter === 'all' || author.grade === parseInt(gradeFilter, 10);
        const classMatch = classFilter === 'all' || author.classNum === parseInt(classFilter, 10);
        
        const searchLower = searchQuery.toLowerCase();
        const searchMatch = !searchQuery ||
            author.name.toLowerCase().includes(searchLower) ||
            submission.koreanName.toLowerCase().includes(searchLower) ||
            submission.challengeName.toLowerCase().includes(searchLower) ||
            submission.evidence.toLowerCase().includes(searchLower);

        return gradeMatch && classMatch && searchMatch;
    });
  }, [submissions, userMap, gradeFilter, classFilter, searchQuery]);


  if (authLoading || usersLoading || configLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2">
            <GalleryThumbnails /> 도전 갤러리
        </h1>
        <Button variant="outline" onClick={() => router.push(user?.role === 'teacher' ? '/admin' : '/dashboard')} className="self-end sm:self-auto">
            <ArrowLeft className="mr-2"/> {user?.role === 'teacher' ? '관리자 페이지로' : '대시보드로'}
        </Button>
      </header>

      <Card className="mb-8 shadow-md border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch gap-2">
            <div className="flex items-center gap-2">
                <Select value={gradeFilter} onValueChange={setGradeFilter}>
                    <SelectTrigger className="w-full md:w-[120px]">
                        <SelectValue placeholder="학년" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 학년</SelectItem>
                        {availableGrades.map(grade => (
                            grade != null && <SelectItem key={grade} value={String(grade)}>{grade}학년</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={classFilter} onValueChange={setClassFilter} disabled={availableClasses.length === 0 || gradeFilter === 'all'}>
                    <SelectTrigger className="w-full md:w-[120px]">
                        <SelectValue placeholder="반" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 반</SelectItem>
                        {availableClasses.map(classNum => (
                            classNum != null && <SelectItem key={classNum} value={String(classNum)}>{classNum}반</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="relative w-full md:flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="학생 이름 또는 내용으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
            </div>
        </CardContent>
      </Card>
      
      {loadingInitial ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({length: 3}).map((_, i) => <Card key={i} className="h-80"><Skeleton className="w-full h-full" /></Card>)}
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-semibold text-muted-foreground">아직 제출된 도전이 없어요!</p>
          <p className="text-sm text-muted-foreground">가장 먼저 도전 내용을 제출하고 갤러리를 채워보세요.</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-20">
            <p className="text-lg font-semibold text-muted-foreground">검색 결과가 없습니다.</p>
            <p className="text-sm text-muted-foreground">다른 필터를 선택하거나 검색어를 변경해보세요.</p>
            {hasMore && (
                <Button onClick={fetchMoreSubmissions} disabled={loadingMore} variant="link" className="mt-4">
                    혹은, 더 많은 게시물 불러오기
                </Button>
            )}
        </div>
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSubmissions.map(sub => <GalleryCard key={sub.id} submission={sub} user={user} onSubmissionDeleted={handleSubmissionDeleted} onSubmissionUpdated={handleSubmissionUpdated}/>)}
            </div>
            {hasMore && (
                <div className="mt-12 text-center">
                    <Button onClick={fetchMoreSubmissions} disabled={loadingMore}>
                        {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        더 보기
                    </Button>
                </div>
            )}
        </>
      )}
    </div>
  );
}


