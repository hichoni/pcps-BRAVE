
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { generateCommentSuggestions } from '@/ai/flows/generate-comment-suggestions';
import { addComment } from '@/ai/flows/add-comment';
import { type Comment } from '@/lib/config';
import { Skeleton } from './ui/skeleton';

interface Submission {
    id: string;
    userName: string;
    challengeName: string;
    evidence: string;
}

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Submission;
  onCommentAdded: (newComment: Comment) => void;
}

export function CommentDialog({ open, onOpenChange, submission, onCommentAdded }: CommentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setIsLoading(true);
      setSuggestions([]); // Clear old suggestions
      
      generateCommentSuggestions({
        commenterName: user.name,
        submissionAuthorName: submission.userName,
        submissionChallengeName: submission.challengeName,
        submissionEvidence: submission.evidence,
      }).then(result => {
        if (result?.suggestions) {
          setSuggestions(result.suggestions);
        } else {
            toast({ variant: 'destructive', title: '오류', description: '댓글을 생성하지 못했습니다.' });
        }
      }).catch(error => {
        console.error("Error generating comments:", error);
        toast({ variant: 'destructive', title: '오류', description: 'AI 댓글 제안을 불러오는 데 실패했습니다.' });
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [open, user, submission, toast]);

  const handlePostComment = async (comment: string) => {
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setSelectedComment(comment);
    try {
      const result = await addComment({
        submissionId: submission.id,
        userId: user.username,
        userName: user.name,
        comment: comment,
      });
      
      if (result.success) {
        toast({ title: '성공', description: '댓글이 성공적으로 등록되었습니다.' });
        // Convert string date from server back to Date object for client-side consistency
        const newCommentWithDate: Comment = {
          ...result.newComment,
          createdAt: new Date(result.newComment.createdAt),
        };
        onCommentAdded(newCommentWithDate);
        onOpenChange(false);
      }
    } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: error.message || '댓글 등록에 실패했습니다.' });
    } finally {
        setIsSubmitting(false);
        setSelectedComment(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare /> AI 댓글 추천
          </DialogTitle>
          <DialogDescription>
            AI가 추천하는 긍정적인 댓글로 친구를 응원해주세요!
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          ) : (
            suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full h-auto text-left justify-start py-3 whitespace-normal"
                onClick={() => handlePostComment(suggestion)}
                disabled={isSubmitting}
              >
                {isSubmitting && selectedComment === suggestion ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Send className="mr-3" />
                )}
                {suggestion}
              </Button>
            ))
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="w-full">
              닫기
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
