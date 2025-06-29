"use client";

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { AVATAR_OPTIONS } from './PredefinedAvatars';
import { cn } from '@/lib/utils';
import { User } from '@/lib/config';

interface UserAvatarProps {
    user: Partial<User> | null;
    className?: string;
}

export function UserAvatar({ user, className }: UserAvatarProps) {
    if (!user || !user.name) {
        return (
             <Avatar className={cn("bg-muted", className)}>
                <AvatarFallback>?</AvatarFallback>
            </Avatar>
        );
    }

    const avatarKey = user.profileAvatar?.startsWith('avatar:') ? user.profileAvatar : null;
    const AvatarInfo = avatarKey ? AVATAR_OPTIONS.find(opt => opt.key === avatarKey) : null;
    const AvatarIcon = AvatarInfo?.component;

    if (user.profileAvatar?.startsWith('https://')) {
        return (
            <Avatar className={className}>
                <AvatarImage src={user.profileAvatar} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
        );
    }
    
    if (AvatarIcon) {
        return (
            <Avatar className={cn("p-1.5 bg-secondary text-secondary-foreground", className)}>
                <AvatarIcon />
            </Avatar>
        );
    }

    return (
        <Avatar className={className}>
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
        </Avatar>
    );
}
