"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, MOCK_USERS } from '@/lib/config';
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

  const fetchUsers = useCallback(async () => {
    if (!db) {
      setUsers(MOCK_USERS);
      return;
    }
    
    try {
      const usersCollectionRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollectionRef);
      if (usersSnapshot.empty) {
        // If DB is empty, seed with MOCK_USERS
        console.log("No users found in Firestore. Seeding with mock data...");
        const batch = writeBatch(db);
        MOCK_USERS.forEach(userToSeed => {
            const docRef = doc(db, "users", String(userToSeed.id)); // Use string ID for document ID
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
        setUsers(MOCK_USERS); // Fallback to mock users on error
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      await fetchUsers();
      try {
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) {
          const parsedUser = JSON.parse(sessionUser);
          // Re-validate user data from the freshly fetched users list
          const currentUserData = users.find((u: User) => u.id === parsedUser.id);
          setUser(currentUserData || null);
        }
      } catch (error) {
        console.warn("Auth context initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUsers]);
  
  // This useEffect re-validates the session user when the users list is updated.
  useEffect(() => {
      if (user) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

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
        const userDocRef = doc(db, "users", String(targetUser.id));
        await deleteDoc(userDocRef);
    } catch (e) {
        console.warn("Failed to delete user from Firestore", e);
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
        const userDocRef = doc(db, "users", String(newUser.id));
        await setDoc(userDocRef, newUser);
    } catch (e) {
        console.warn("Failed to add user to Firestore", e);
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
            const docRef = doc(db, "users", String(newUser.id));
            batch.set(docRef, newUser);
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
            console.warn("Failed to bulk add users to Firestore", e);
          }
      }
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
