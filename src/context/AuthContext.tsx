
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, MOCK_USERS, AreaName, AchievementsState, DEFAULT_AREAS_CONFIG } from '@/lib/config';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, query, where, writeBatch, deleteDoc, updateDoc, addDoc, getDoc, limit } from 'firebase/firestore';


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
  deleteUser: (username:string) => Promise<void>;
  addUser: (studentData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: number, studentData: Partial<Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>>) => Promise<{ success: boolean; message: string }>;
  bulkAddUsers: (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]) => Promise<{ successCount: number; failCount: number; errors: string[] }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to avoid circular dependency
// Note: This now generates an empty object. The AchievementsContext is responsible for populating it based on the ChallengeConfig.
const generateInitialStateForUser = (): AchievementsState => {
    return {} as AchievementsState;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const router = useRouter();
  
  const fetchUsers = useCallback(async (): Promise<User[]> => {
    setUsersLoading(true);
    if (!db) {
      console.warn("Firebase is disabled. Using mock users.");
      setUsers(MOCK_USERS);
      setUsersLoading(false);
      return MOCK_USERS;
    }
    try {
      const usersCollectionRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollectionRef);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: parseInt(doc.id, 10),
        ...(doc.data() as Omit<User, 'id'>),
      }));
      setUsers(usersList);
      return usersList;
    } catch(error) {
        console.error("AuthContext: Error fetching users from Firestore. This might be a connection issue or Firestore is not enabled.", error);
        console.warn("AuthContext: Falling back to mock user data.");
        setUsers(MOCK_USERS);
        return MOCK_USERS;
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeAuthAndCleanup = async () => {
        setLoading(true);

        if (db) {
            try {
                // --- Definitive Cleanup: Remove all 6 initial mock students if they exist ---
                const mockStudentUsernames = ['s-4-1-1', 's-4-1-2', 's-5-2-3', 's-5-2-4', 's-6-3-5', 's-6-3-6'];
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("username", "in", mockStudentUsernames));
                const querySnapshot = await getDocs(q);
                
                if (!querySnapshot.empty) {
                    console.log("Found initial mock students in the database. Deleting them now...");
                    const batch = writeBatch(db);
                    querySnapshot.forEach((docToDelete) => {
                        const userData = docToDelete.data() as User;
                        console.log(`Deleting mock user: ${userData.name} (Username: ${userData.username})`);
                        batch.delete(docToDelete.ref);

                        // Also delete their achievements document
                        const achievementDocRef = doc(db, 'achievements', userData.username);
                        batch.delete(achievementDocRef);
                    });
                    await batch.commit();
                    console.log("Initial mock students have been permanently deleted.");
                }

                // --- Robust Seeding Logic ---
                // Seed initial data ONLY if the users collection is completely empty.
                const usersQuery = query(collection(db, "users"), limit(1));
                const usersSnapshot = await getDocs(usersQuery);
                if (usersSnapshot.empty) {
                    console.log("Users collection is empty. Seeding initial teacher data...");
                    const seedBatch = writeBatch(db);
                    // MOCK_USERS now only contains teachers, so this is safe.
                    for (const userToSeed of MOCK_USERS) {
                        const userDocRef = doc(db, "users", String(userToSeed.id));
                        seedBatch.set(userDocRef, userToSeed);
                    }
                    // Seed config as well
                    const configDocRef = doc(db, 'config/challengeConfig');
                    const configDocSnap = await getDoc(configDocRef);
                     if (!configDocSnap.exists()) {
                        seedBatch.set(configDocRef, DEFAULT_AREAS_CONFIG);
                     }
                    
                    await seedBatch.commit();
                    console.log("Initial data seeding complete.");
                }
            } catch (error) {
                 console.error("AuthContext: Error during cleanup or seeding.", error);
            }
        }

        // --- Continue with normal startup ---
        const sessionUser = sessionStorage.getItem('user');
        if (sessionUser) {
            setUser(JSON.parse(sessionUser));
        }
        await fetchUsers(); // Fetch the now-clean user list
        setLoading(false);
    };

    initializeAuthAndCleanup();
  }, [fetchUsers]);
  
  const ensureUsersLoaded = useCallback(async (): Promise<User[]> => {
    if (users.length > 0 && !usersLoading) {
        return users;
    }
    return fetchUsers();
  }, [users, fetchUsers, usersLoading]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user');
    router.push('/');
  }, [router]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User | null> => {
    const { pin, username, grade, classNum, studentNum } = credentials;
    // Always fetch the latest user data directly from the source for maximum reliability
    const currentUsers = await fetchUsers();
    
    let targetUser: User | undefined;

    if (username) { // Teacher login
      console.log(`Attempting teacher login for username: "${username}"`);
      targetUser = currentUsers.find(u => 
        u.role === 'teacher' && 
        u.username === username && 
        String(u.pin) === String(pin)
      );
    } else if (grade !== undefined && classNum !== undefined && studentNum !== undefined) { // Student login
      console.log(`Attempting student login for ${grade}-${classNum}-${studentNum}`);
      targetUser = currentUsers.find(u =>
        u.role === 'student' &&
        Number(u.grade) === Number(grade) &&
        Number(u.classNum) === Number(classNum) &&
        Number(u.studentNum) === Number(studentNum) &&
        String(u.pin) === String(pin)
      );
    }
    
    if (targetUser) {
      console.log("Login successful for user:", targetUser.name);
      setUser(targetUser);
      sessionStorage.setItem('user', JSON.stringify(targetUser));
      return targetUser;
    }
    
    console.error("Login failed. No user found with provided credentials.");
    return null;
  }, [fetchUsers]);

  const updatePin = useCallback(async (newPin: string) => {
    if (!user) throw new Error("사용자 정보가 없습니다. 다시 로그인해주세요.");
    if (!db) throw new Error("데이터베이스에 연결되지 않았습니다. 설정을 확인해주세요.");

    const userDocRef = doc(db, "users", String(user.id));
    try {
      await setDoc(userDocRef, { pin: newPin }, { merge: true });
      
      const updatedUser = { ...user, pin: newPin };
      setUser(updatedUser);
      setUsers(prevUsers => prevUsers.map(u => (u.id === user.id ? updatedUser : u)));
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error("PIN 업데이트 실패 (Firestore):", error);
      throw new Error("데이터베이스 저장에 실패했습니다. 인터넷 연결을 확인하거나 관리자에게 문의하세요.");
    }
  }, [user]);

  const resetPin = useCallback(async (username: string) => {
    if (!db) throw new Error("데이터베이스에 연결되지 않았습니다. 설정을 확인해주세요.");

    const currentUsers = await ensureUsersLoaded();
    const targetUser = currentUsers.find(u => u.username === username);

    if (!targetUser) throw new Error(`사용자 '${username}'를 찾을 수 없습니다.`);

    const userDocRef = doc(db, "users", String(targetUser.id));
    try {
        await setDoc(userDocRef, { pin: '0000' }, { merge: true });
        
        const updatedUser = { ...targetUser, pin: '0000' };
        setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));

        if (user && user.id === updatedUser.id) {
            setUser(updatedUser);
            sessionStorage.setItem('user', JSON.stringify(updatedUser));
        }
    } catch (error) {
        console.error(`PIN 초기화 실패 (Firestore) - 사용자: ${username}:`, error);
        throw new Error("데이터베이스 저장에 실패하여 PIN을 초기화할 수 없습니다.");
    }
  }, [user, ensureUsersLoaded]);

  const deleteUser = useCallback(async (username: string) => {
    if (!db) throw new Error("데이터베이스에 연결되지 않았습니다. 설정을 확인해주세요.");

    const currentUsers = await ensureUsersLoaded();
    const targetUser = currentUsers.find(u => u.username === username);
    if (!targetUser) {
      console.log(`User with username ${username} not found for deletion.`);
      return;
    }
    
    try {
        const batch = writeBatch(db);
        const userDocRef = doc(db, "users", String(targetUser.id));
        batch.delete(userDocRef);
        
        const achievementDocRef = doc(db, 'achievements', username);
        batch.delete(achievementDocRef);

        await batch.commit();

        setUsers(prevUsers => prevUsers.filter(u => u.username !== username));
        
        if (user && user.username === username) {
            logout();
        }
    } catch (e) {
        console.error("Failed to delete user and achievements from Firestore", e);
        throw e;
    }
  }, [user, logout, ensureUsersLoaded]);

  const addUser = useCallback(async (studentData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>): Promise<{ success: boolean; message: string }> => {
    if (!db) return { success: false, message: "데이터베이스에 연결되지 않았습니다. 설정을 확인해주세요." };

    const { grade, classNum, studentNum, name } = studentData;
    const currentUsers = await ensureUsersLoaded();

    const studentExists = currentUsers.some(u =>
      u.role === 'student' &&
      Number(u.grade) === Number(grade) &&
      Number(u.classNum) === Number(classNum) &&
      Number(u.studentNum) === Number(studentNum)
    );

    if (studentExists) {
      return { success: false, message: `${grade}학년 ${classNum}반 ${studentNum}번 학생은 이미 존재합니다.` };
    }

    const newId = (currentUsers.length > 0 ? Math.max(...currentUsers.map(u => u.id)) : 0) + 1;
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
    
    try {
        const batch = writeBatch(db);
        const userDocRef = doc(db, "users", String(newUser.id));
        batch.set(userDocRef, newUser);
        
        const achievementDocRef = doc(db, 'achievements', newUser.username);
        batch.set(achievementDocRef, generateInitialStateForUser());
        
        await batch.commit();

        setUsers(prev => [...prev, newUser]);
        return { success: true, message: `${name} 학생이 추가되었습니다.` };
    } catch (e) {
        console.error("Failed to add user and achievements to Firestore", e);
        return { success: false, message: '데이터베이스 저장에 실패했습니다.' };
    }
  }, [ensureUsersLoaded]);

  const updateUser = useCallback(async (userId: number, studentData: Partial<Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>>): Promise<{ success: boolean; message: string }> => {
    if (!db) return { success: false, message: "데이터베이스에 연결되지 않았습니다." };

    const currentUsers = await ensureUsersLoaded();
    const targetUser = currentUsers.find(u => u.id === userId);

    if (!targetUser) {
        return { success: false, message: "수정할 학생을 찾을 수 없습니다." };
    }

    const updatedUserData = { ...targetUser, ...studentData };
    
    if (studentData.grade || studentData.classNum || studentData.studentNum) {
        const studentExists = currentUsers.some(u =>
          u.id !== userId &&
          u.role === 'student' &&
          Number(u.grade) === Number(updatedUserData.grade) &&
          Number(u.classNum) === Number(updatedUserData.classNum) &&
          Number(u.studentNum) === Number(updatedUserData.studentNum)
        );

        if (studentExists) {
          return { success: false, message: `${updatedUserData.grade}학년 ${updatedUserData.classNum}반 ${updatedUserData.studentNum}번 학생은 이미 존재합니다.` };
        }
    }
    
    const oldUsername = targetUser.username;
    const newUsername = `s-${updatedUserData.grade}-${updatedUserData.classNum}-${updatedUserData.studentNum}`;
    const usernameChanged = oldUsername !== newUsername;

    const finalUserData = {
        ...updatedUserData,
        username: newUsername
    };

    try {
        const batch = writeBatch(db);
        const userDocRef = doc(db, "users", String(userId));
        
        if (usernameChanged) {
            const oldAchievementRef = doc(db, 'achievements', oldUsername);
            const oldAchievementSnap = await getDoc(oldAchievementRef);
            
            if (oldAchievementSnap.exists()) {
                const newAchievementRef = doc(db, 'achievements', newUsername);
                batch.set(newAchievementRef, oldAchievementSnap.data());
                batch.delete(oldAchievementRef);
            }
        }
        
        const { id, ...dataToWrite } = finalUserData;
        batch.update(userDocRef, dataToWrite);

        await batch.commit();

        setUsers(prev => prev.map(u => u.id === userId ? finalUserData : u));
        if (user && user.id === userId) {
            setUser(finalUserData);
            sessionStorage.setItem('user', JSON.stringify(finalUserData));
        }

        return { success: true, message: "학생 정보가 성공적으로 수정되었습니다." };
    } catch (e) {
        console.error("Failed to update user", e);
        return { success: false, message: "학생 정보 수정에 실패했습니다." };
    }
  }, [ensureUsersLoaded, user]);

  const bulkAddUsers = useCallback(async (studentsData: Pick<User, 'grade' | 'classNum' | 'studentNum' | 'name'>[]): Promise<{ successCount: number; failCount: number; errors: string[] }> => {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    const newUsers: User[] = [];
    
    if (!db) {
      return { successCount: 0, failCount: studentsData.length, errors: ["데이터베이스에 연결되지 않았습니다. 설정을 확인해주세요."] };
    }

    const currentUsers = await ensureUsersLoaded();
    let lastId = (currentUsers.length > 0 ? Math.max(...currentUsers.map(u => u.id)) : 0);
    const batch = writeBatch(db);
    const usersInThisOperation = [...currentUsers];

    studentsData.forEach((student, index) => {
      const { grade, classNum, studentNum, name } = student;
      const studentExists = usersInThisOperation.some(u =>
        u.role === 'student' &&
        Number(u.grade) === Number(grade) &&
        Number(u.classNum) === Number(classNum) &&
        Number(u.studentNum) === Number(studentNum)
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
        usersInThisOperation.push(newUser);
        const userDocRef = doc(db, "users", String(newUser.id));
        batch.set(userDocRef, newUser);
        
        const achievementDocRef = doc(db, "achievements", newUser.username);
        batch.set(achievementDocRef, generateInitialStateForUser());
        successCount++;
      }
    });

    if (newUsers.length > 0) {
      try {
        await batch.commit();
        setUsers(prev => [...prev, ...newUsers].sort((a,b) => a.id - b.id));
      } catch(e) {
        console.error("Failed to bulk add users and achievements to Firestore", e);
        return { successCount: 0, failCount: studentsData.length, errors: ['데이터베이스에 일괄 등록하는 데 실패했습니다.'] };
      }
    }
    
    return { successCount, failCount, errors };
  }, [ensureUsersLoaded]);


  return (
    <AuthContext.Provider value={{ user, users, loading, usersLoading, login, logout, updatePin, resetPin, deleteUser, addUser, updateUser, bulkAddUsers }}>
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
