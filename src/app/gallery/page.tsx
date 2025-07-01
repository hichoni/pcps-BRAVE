
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, User } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query, Timestamp, limit, startAfter, QueryDocumentSnapshot, where } from 'firebase/firestore';
import { Loader2, ArrowLeft, User as UserIcon, Calendar as CalendarIcon, GalleryThumbnails, Trash2, Heart, Search, Edit, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/UserAvatar';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useChallengeConfig } from '@/context/ChallengeConfigContext';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteSubmission } from '@/ai/flows/delete-submission';
import { toggleLike } from '@/ai/flows/toggle-like';
import { reviewSubmission } from '@/ai/flows/review-submission';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EditSubmissionDialog } from '@/components/EditSubmissionDialog';
import { SubmissionStatus, CertificateStatus, STATUS_CONFIG } from '@/lib/config';
import { Badge } from '@/components/ui/badge';
import { useAchievements } from '@/context/AchievementsContext';


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
  showInGallery: boolean;
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

const getYoutubeId = (url: string | undefined): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

function GalleryCard({ submission, user, author, onSubmissionDeleted, onSubmissionUpdated, statusInfo }: { submission: Submission; user: User | null; author: User | null, onSubmissionDeleted: (id: string) => void, onSubmissionUpdated: (updatedSubmission: Partial<Submission> & { id: string }) => void, statusInfo: typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG] }) {
  const { challengeConfig } = useChallengeConfig();
  const { toast } = useToast();
  const AreaIcon = challengeConfig?.[submission.areaName]?.icon || UserIcon;
  const youtubeId = getYoutubeId(submission.mediaUrl);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isLiked, setIsLiked] = useState(user ? submission.likes.includes(user.username) : false);
  const [likeCount, setLikeCount] = useState(submission.likes.length);
  const [isEditing, setIsEditing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  const isOwner = user?.username === submission.userId;
  const canManage = user && (isOwner || user.role === 'teacher');
  const isPending = submission.status === 'pending_deletion' || submission.status === 'pending_review';
  const isRejected = submission.status === 'rejected';

  const handleManualApprove = async () => {
    if (!user || user.role !== 'teacher') return;
    setIsApproving(true);
    try {
      const result = await reviewSubmission({
        submissionId: submission.id,
        isApproved: true,
        teacherId: String(user.id),
      });
      toast({ title: '승인 완료', description: result.message });
      onSubmissionUpdated({ id: submission.id, status: 'approved' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '승인 처리 오류', description: error.message });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const result = await deleteSubmission({ submissionId: submission.id, userId: String(user.id) });
      toast({ title: '처리 완료', description: result.message });
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
    <Card className="flex flex-col h-full shadow-md hover:shadow-xl transition-shadow duration-300 border relative">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
         <UserAvatar user={author} />
         <div className="flex-grow">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <span>{maskName(submission.userName)} 학생</span>
              {statusInfo && (
                <div title={statusInfo.label}>
                    <statusInfo.icon className={cn("w-5 h-5", statusInfo.color)} />
                </div>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 text-xs pt-1">
                <CalendarIcon className="w-3 h-3"/>
                {submission.createdAt ? formatDistanceToNow(submission.createdAt, { addSuffix: true, locale: ko }) : '방금 전'}
            </CardDescription>
         </div>
         <div className="flex flex-col items-end gap-2">
             {user?.role === 'teacher' && (
                <div className="flex items-center gap-1">
                    <Badge variant={submission.status === 'approved' ? 'default' : (submission.status === 'rejected' ? 'destructive' : 'secondary')} className="capitalize text-xs">
                        {submission.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant={submission.showInGallery ? 'secondary' : 'outline'} className="text-xs">
                        {submission.showInGallery ? '갤러리 표시' : '숨김'}
                    </Badge>
                </div>
            )}
            {canManage && (
                <div className="flex items-center -mr-2">
                    {user.role === 'teacher' && isRejected && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-green-600" onClick={handleManualApprove} disabled={isApproving} title="수동으로 승인하기">
                            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                    )}
                    {user.role === 'teacher' && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setIsEditing(true)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                    )}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={isDeleting || isPending}>
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
                                    ? "이 게시글을 삭제하면 되돌릴 수 없습니다. 갤러리에서 영구적으로 사라지며, 학생의 관련 성취도도 함께 조정됩니다." 
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
         </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="p-3 bg-secondary/50 rounded-md">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <AreaIcon className="w-4 h-4" />
                <span>{submission.koreanName} - {submission.challengeName}</span>
            </div>
        </div>

        {youtubeId ? (
            <div className="my-2 rounded-lg border overflow-hidden aspect-video">
                <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                ></iframe>
            </div>
        ) : submission.mediaUrl && submission.mediaType?.startsWith('image/') ? (
            <div className="my-2 rounded-lg border overflow-hidden">
                <Image 
                    src={submission.mediaUrl}
                    alt={`${submission.koreanName} 활동 증명`}
                    width={400}
                    height={300}
                    className="w-full h-auto object-cover aspect-video"
                />
            </div>
        ) : submission.mediaUrl && submission.mediaType?.startsWith('video/') ? (
            <div className="my-2 rounded-lg border overflow-hidden">
                <video 
                    src={submission.mediaUrl}
                    controls
                    className="w-full aspect-video"
                />
            </div>
        ) : submission.mediaUrl ? (
             <a href={submission.mediaUrl} target="_blank" rel="noopener noreferrer" className="block my-2">
                <div className="p-3 bg-background rounded-md border flex items-center justify-center gap-2 text-sm hover:bg-secondary">
                   <LinkIcon className="w-4 h-4" />
                   <span>미디어 링크 보기</span>
                </div>
             </a>
        ) : null}

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
  const { certificateStatus, loading: achievementsLoading } = useAchievements();
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

  const fetchInitialSubmissions = useCallback(async () => {
      if (!db || !user || !challengeConfig || configLoading) {
          setLoadingInitial(false);
          return;
      };
      setLoadingInitial(true);
      try {
        const q = query(
            collection(db, "challengeSubmissions"),
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
            showInGallery: data.showInGallery === true,
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
    }, [user, configLoading, challengeConfig]);

  useEffect(() => {
    if (user && !configLoading) {
      fetchInitialSubmissions();
    }
  }, [user, configLoading, fetchInitialSubmissions]);

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
                showInGallery: data.showInGallery === true,
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
  
  const handleSubmissionUpdated = useCallback((updatedSubmission: Partial<Submission> & { id: string }) => {
    setSubmissions(prev => prev.map(s => s.id === updatedSubmission.id ? { ...s, ...updatedSubmission } : s));
  }, []);

  const allStudentUsers = users.filter(u => u.role === 'student');
  const availableGrades = [...new Set(allStudentUsers.map(u => u.grade))].sort((a,b) => (a ?? 0) - (b ?? 0));
  const studentsForClassList = allStudentUsers.filter(u => gradeFilter === 'all' || u.grade === parseInt(gradeFilter, 10));
  const availableClasses = [...new Set(studentsForClassList.map(u => u.classNum))].sort((a,b) => (a ?? 0) - (b ?? 0));
  
  const userMap = useMemo(() => new Map(users.map(u => [u.username, u])), [users]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter(submission => {
        // Role-based filtering: students only see approved & gallery-enabled posts.
        if (user?.role === 'student') {
            if (submission.status !== 'approved' || submission.showInGallery !== true) {
                return false;
            }
        }

        const author = userMap.get(submission.userId);

        if (author) {
            const gradeMatch = gradeFilter === 'all' || author.grade === parseInt(gradeFilter, 10);
            if (!gradeMatch) return false;

            const classMatch = classFilter === 'all' || author.classNum === parseInt(classFilter, 10);
            if (!classMatch) return false;
        } else {
            if (gradeFilter !== 'all' || classFilter !== 'all') {
                return false;
            }
        }
        
        const searchLower = searchQuery.toLowerCase();
        const searchMatch = !searchQuery ||
            submission.userName.toLowerCase().includes(searchLower) ||
            submission.koreanName.toLowerCase().includes(searchLower) ||
            submission.challengeName.toLowerCase().includes(searchLower) ||
            submission.evidence.toLowerCase().includes(searchLower) ||
            (author && author.name.toLowerCase().includes(searchLower));

        return searchMatch;
    });
  }, [submissions, user, userMap, gradeFilter, classFilter, searchQuery]);


  if (authLoading || usersLoading || configLoading || achievementsLoading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b">
        <h1 className="text-2xl sm:text-3xl font-bold font-headline text-primary flex items-center gap-2">
            <GalleryThumbnails /> {user?.role === 'teacher' ? '도전 갤러리 (관리자)' : '도전 갤러리'}
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
              {filteredSubmissions.map(sub => {
                const author = userMap.get(sub.userId) || null;
                const statusInfo = STATUS_CONFIG[certificateStatus(sub.userId)];
                return <GalleryCard key={sub.id} submission={sub} user={user} author={author} onSubmissionDeleted={handleSubmissionDeleted} onSubmissionUpdated={handleSubmissionUpdated} statusInfo={statusInfo} />
              })}
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
