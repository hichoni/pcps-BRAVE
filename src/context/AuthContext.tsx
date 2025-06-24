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

export type { User };

interface AuthContextType {
  user: User | null;
  users: User[];
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<User | null>;
  logout: () => void;
  updatePin: (newPin: string) => Promise<void>;
  resetPin: (username: string) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
  addUser: (studentData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>) => Promise<{ success: boolean; message: string }>;
  bulkAddUsers: (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]) => Promise<{ successCount: number; failCount: number; errors: string[] }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedUsersRaw = localStorage.getItem('users');
      const storedUsers = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

      const userMap = new Map<number, User>();
      MOCK_USERS.forEach(u => userMap.set(u.id, u));
      (storedUsers as User[]).forEach(u => userMap.set(u.id, u));
      
      const allUsers = Array.from(userMap.values());
      persistUsers(allUsers);
      
      const sessionUser = sessionStorage.getItem('user');
      if (sessionUser) {
        const parsedUser = JSON.parse(sessionUser);
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
    if (user?.username === username) {
      logout();
    }
  }, [users, user, logout]);

  const addUser = useCallback(async (studentData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>): Promise<{ success: boolean; message: string }> => {
    const { grade, classNum, studentNum, name } = studentData;

    const studentExists = users.some(u =>
      u.role === 'student' &&
      u.grade === grade &&
      u.classNum === classNum &&
      u.studentNum === studentNum
    );

    if (studentExists) {
      return { success: false, message: `${grade}학년 ${classNum}반 ${studentNum}번 학생은 이미 존재합니다.` };
    }

    const newId = Math.max(0, ...users.map(u => u.id)) + 1;
    const newUsername = `s-${grade}-${classNum}-${studentNum}`;

    const newUser: User = {
      id: newId,
      username: newUsername,
      pin: '0000',
      role: 'student',
      grade,
      classNum,
      studentNum,
      name,
    };

    persistUsers([...users, newUser]);
    return { success: true, message: `${name} 학생이 추가되었습니다.` };
  }, [users]);

  const bulkAddUsers = useCallback(async (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]): Promise<{ successCount: number; failCount: number; errors: string[] }> => {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    const usersToAdd: User[] = [];
    
    const allUsers = [...users];
    let lastId = Math.max(0, ...allUsers.map(u => u.id));

    studentsData.forEach((student, index) => {
      const { grade, classNum, studentNum, name } = student;
      const studentExists = allUsers.some(u =>
        u.role === 'student' &&
        u.grade === grade &&
        u.classNum === classNum &&
        u.studentNum === studentNum
      );
      
      if (studentExists) {
        failCount++;
        errors.push(`${index + 1}번째 줄: ${grade}-${classNum}-${studentNum} ${name} 학생은 이미 존재합니다.`);
      } else {
        lastId++;
        const newUser: User = {
          id: lastId,
          username: `s-${grade}-${classNum}-${studentNum}`,
          pin: '0000',
          role: 'student',
          grade,
          classNum,
          studentNum,
          name,
        };
        usersToAdd.push(newUser);
        allUsers.push(newUser);
        successCount++;
      }
    });

    if (usersToAdd.length > 0) {
      persistUsers([...users, ...usersToAdd]);
    }
    
    return { successCount, failCount, errors };
  }, [users]);


  return (
    <AuthContext.Provider value={{ user, users, loading, login, logout, updatePin, resetPin, deleteUser, addUser, bulkAddUsers }}>
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
