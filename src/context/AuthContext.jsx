import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, googleProvider, db } from '../firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Google OAuth ─────────────────────────────────────
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await _ensureUserProfile(result.user);
    return result.user;
  };

  // ── Email / Password Sign-Up ─────────────────────────
  const signUpWithEmail = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await _ensureUserProfile({ ...result.user, displayName });
    setUser({ ...result.user, displayName });
    return result.user;
  };

  // ── Email / Password Sign-In ─────────────────────────
  const signInWithEmail = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  // ── Password Reset ───────────────────────────────────
  const sendPasswordReset = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // ── Sign Out ─────────────────────────────────────────
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  // ── Internal: Create Firestore profile on first login ─
  const _ensureUserProfile = async (u) => {
    if (!u?.uid) return;
    const ref = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName || '',
        photoURL: u.photoURL || '',
        createdAt: new Date().toISOString(),
      });
    }
  };

  // ── Session helpers (Firestore) ──────────────────────
  const saveSession = async (sessionData) => {
    if (!user) return;
    const sessionRef = doc(collection(db, 'users', user.uid, 'sessions'));
    await setDoc(sessionRef, {
      ...sessionData,
      createdAt: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email,
    });
    return sessionRef.id;
  };

  const updateSession = async (sessionId, updateData) => {
    if (!user || !sessionId) return;
    const sessionRef = doc(db, 'users', user.uid, 'sessions', sessionId);
    await updateDoc(sessionRef, updateData);
  };

  const getSessions = async () => {
    if (!user) return [];
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    logout,
    saveSession,
    updateSession,
    getSessions,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
