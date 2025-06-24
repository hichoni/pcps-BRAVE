
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, MOCK_USERS, AREAS, AreaName, AchievementsState } from '@/lib/config';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, query, where, writeBatch, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';


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
  usersLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<User | null>;
  logout: () => void;
  updatePin: (newPin: string) => Promise<void>;
  resetPin: (username: string) => Promise<void>;
  deleteUser: (username: string) => Promise<void>;
  addUser: (studentData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>) => Promise<{ success: boolean; message: string }>;
  bulkAddUsers: (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]) => Promise<{ successCount: number; failCount: number; errors: string[] }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to avoid circular dependency
const generateInitialStateForUser = (): AchievementsState => {
    const studentAchievements = {} as AchievementsState;
    AREAS.forEach(area => {
        studentAchievements[area] = {
            progress: 0,
            isCertified: false
        };
    });
    return studentAchievements;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const router = useRouter();

  const fetchUsers = useCallback(async (): Promise<void> => {
    setUsersLoading(true);
    if (!db) {
      console.warn("Firebase is disabled. Using local mock data.");
      setUsers(MOCK_USERS);
      setUsersLoading(false);
      return;
    }
    
    try {
      const usersCollectionRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollectionRef);
      if (usersSnapshot.empty) {
        console.log("No users found in Firestore. Seeding with mock data...");
        const batch = writeBatch(db);
        MOCK_USERS.forEach(userToSeed => {
            const docRef = doc(db, "users", String(userToSeed.id));
            batch.set(docRef, userToSeed);
        });
        await batch.commit();
        setUsers(MOCK_USERS);
      } else {
        const usersList = usersSnapshot.docs.map(doc => ({ ...doc.data() } as User));
        setUsers(usersList);
      }
    } catch(error) {
        console.warn("Error fetching users from Firestore:", error);
        setUsers(MOCK_USERS);
    } finally {
        setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      fetchUsers(); // Fire-and-forget, this will populate `users` in the background.
      try {
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) {
          // The user data will be reconciled in the second useEffect
          setUser(JSON.parse(sessionUser));
        }
      } catch (error) {
        console.warn("Auth context initialization error:", error);
      } finally {
        setLoading(false); // This is now fast.
      }
    };

    initializeAuth();
  }, [fetchUsers]);
  
  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user');
    router.push('/login');
  }, [router]);

  // This useEffect re-validates the session user when the users list is updated.
  useEffect(() => {
      if (user && users.length > 0) {
          const updatedUser = users.find(u => u.id === user.id);
          if (updatedUser) {
              if (JSON.stringify(user) !== JSON.stringify(updatedUser)) {
                  setUser(updatedUser);
                  sessionStorage.setItem('user', JSON.stringify(updatedUser));
              }
          } else {
              // User was deleted, log them out
              logout();
          }
      }
  }, [users, user, logout]);

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

  const updatePin = useCallback(async (newPin: string) => {
    if (!user) return;
    
    const updatedUsers = users.map(u => (u.id === user.id ? { ...u, pin: newPin } : u));
    setUsers(updatedUsers);
    
    if (!db) return;

    try {
        const userDocRef = doc(db, "users", String(user.id));
        await updateDoc(userDocRef, { pin: newPin });
    } catch (e) {
        console.warn("Failed to update PIN in Firestore", e);
    }

  }, [user, users]);

  const resetPin = useCallback(async (username: string) => {
    const targetUser = users.find(u => u.username === username);
    if (!targetUser) return;

    const updatedUsers = users.map(u => u.username === username ? { ...u, pin: '0000' } : u);
    setUsers(updatedUsers);
    
    if (!db) return;

    try {
        const userDocRef = doc(db, "users", String(targetUser.id));
        await updateDoc(userDocRef, { pin: '0000' });
    } catch (e) {
        console.warn("Failed to reset PIN in Firestore", e);
    }
  }, [users]);

  const deleteUser = useCallback(async (username: string) => {
    const targetUser = users.find(u => u.username === username);
    if (!targetUser) return;

    const updatedUsers = users.filter(u => u.username !== username);
    setUsers(updatedUsers);
    
    if (!db) return;

    try {
        const batch = writeBatch(db);
        const userDocRef = doc(db, "users", String(targetUser.id));
        batch.delete(userDocRef);
        
        const achievementDocRef = doc(db, 'achievements', username);
        batch.delete(achievementDocRef);

        await batch.commit();
    } catch (e) {
        console.warn("Failed to delete user and achievements from Firestore", e);
    }
  }, [users]);

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

    const newId = (users.length > 0 ? Math.max(...users.map(u => u.id)) : 0) + 1;
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
    
    setUsers(prev => [...prev, newUser]);
    
    if (!db) {
        return { success: true, message: `${name} 학생이 추가되었습니다. (DB 연결 안됨)` };
    }

    try {
        const batch = writeBatch(db);
        const userDocRef = doc(db, "users", String(newUser.id));
        batch.set(userDocRef, newUser);
        
        const achievementDocRef = doc(db, 'achievements', newUser.username);
        batch.set(achievementDocRef, generateInitialStateForUser());
        
        await batch.commit();

    } catch (e) {
        console.warn("Failed to add user and achievements to Firestore", e);
    }

    return { success: true, message: `${name} 학생이 추가되었습니다.` };
  }, [users]);

  const bulkAddUsers = useCallback(async (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]): Promise<{ successCount: number; failCount: number; errors: string[] }> => {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    const newUsers: User[] = [];
    
    let lastId = (users.length > 0 ? Math.max(...users.map(u => u.id)) : 0);
    const batch = db ? writeBatch(db) : null;
    const currentUsers = [...users];

    studentsData.forEach((student, index) => {
      const { grade, classNum, studentNum, name } = student;
      const studentExists = currentUsers.some(u =>
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
        newUsers.push(newUser);
        currentUsers.push(newUser); // Add to temp list to check for duplicates within the same file
        if (batch) {
            const userDocRef = doc(db, "users", String(newUser.id));
            batch.set(userDocRef, newUser);
            
            const achievementDocRef = doc(db, "achievements", newUser.username);
            batch.set(achievementDocRef, generateInitialStateForUser());
        }
        successCount++;
      }
    });

    if (newUsers.length > 0) {
      setUsers(prev => [...prev, ...newUsers].sort((a,b) => a.id - b.id));
      if (batch) {
          try {
            await batch.commit();
          } catch(e) {
            console.warn("Failed to bulk add users and achievements to Firestore", e);
          }
      }
    }
    
    return { successCount, failCount, errors };
  }, [users]);


  return (
    <AuthContext.Provider value={{ user, users, loading, usersLoading, login, logout, updatePin, resetPin, deleteUser, addUser, bulkAddUsers }}>
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
