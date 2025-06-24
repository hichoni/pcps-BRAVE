"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, MOCK_USERS } from '@/lib/config';

interface LoginCredentials {
  pin: string;
  username?: string; // For teacher
  grade?: number;    // For student
  classNum?: number; // For student
  studentNum?: number; // For student
}

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User | null>;
  logout: () => void;
  updatePin: (newPin: string) => Promise<void>;
  resetPin: (username: string) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      // Load users from "DB" (localStorage) and merge with MOCK_USERS
      const storedUsersRaw = localStorage.getItem('users');
      const storedUsers = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

      const userMap = new Map<number, User>();
      // Add MOCK_USERS first. This ensures new users from the config are included.
      MOCK_USERS.forEach(u => userMap.set(u.id, u));
      // Overwrite with any stored users to preserve changes (like PIN updates).
      (storedUsers as User[]).forEach(u => userMap.set(u.id, u));
      
      const allUsers = Array.from(userMap.values());
      persistUsers(allUsers); // This also calls setUsers
      
      // Check for active session
      const sessionUser = sessionStorage.getItem('user');
      if (sessionUser) {
        const parsedUser = JSON.parse(sessionUser);
        // Make sure user data is up-to-date from our "DB"
        const currentUserData = allUsers.find((u: User) => u.id === parsedUser.id);
        setUser(currentUserData || null);
      }
    } catch (error) {
      console.error("Auth context initialization error:", error);
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  }, []);

  const persistUsers = (updatedUsers: User[]) => {
    setUsers(updatedUsers);
    localStorage.setItem('users', JSON.stringify(updatedUsers));
  }

  const login = useCallback(async (credentials: LoginCredentials): Promise<User | null> => {
    const { pin, username, grade, classNum, studentNum } = credentials;
    let targetUser: User | undefined;

    if (username) { // Teacher login
      targetUser = users.find(u => u.role === 'teacher' && u.username === username && u.pin === pin);
    } else if (grade && classNum && studentNum) { // Student login
      targetUser = users.find(u =>
        u.role === 'student' &&
        u.grade === grade &&
        u.classNum === classNum &&
        u.studentNum === studentNum &&
        u.pin === pin
      );
    }
    
    if (targetUser) {
      setUser(targetUser);
      sessionStorage.setItem('user', JSON.stringify(targetUser));
      return targetUser;
    }
    return null;
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user');
    router.push('/login');
  }, [router]);

  const updatePin = useCallback(async (newPin: string) => {
    if (!user) throw new Error("No user logged in");

    const updatedUsers = users.map(u => 
      u.id === user.id ? { ...u, pin: newPin } : u
    );
    persistUsers(updatedUsers);
    const updatedCurrentUser = { ...user, pin: newPin };
    setUser(updatedCurrentUser);
    sessionStorage.setItem('user', JSON.stringify(updatedCurrentUser));

  }, [user, users]);

  const resetPin = useCallback(async (username: string) => {
    const updatedUsers = users.map(u =>
      u.username === username ? { ...u, pin: '0000' } : u
    );
    persistUsers(updatedUsers);
  }, [users]);

  const deleteUser = useCallback(async (username: string) => {
    const updatedUsers = users.filter(u => u.username !== username);
    persistUsers(updatedUsers);
    // If the deleted user is the one logged in, log them out.
    if (user?.username === username) {
      logout();
    }
  }, [users, user, logout]);

  return (
    <AuthContext.Provider value={{ user, users, loading, login, logout, updatePin, resetPin, deleteUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
