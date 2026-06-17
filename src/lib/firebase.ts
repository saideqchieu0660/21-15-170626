import { initializeApp } from "firebase/app";
import { initializeFirestore, memoryLocalCache, collection, addDoc, doc, setDoc, getDoc, updateDoc, query, where, getDocs, deleteDoc, arrayRemove } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Fetch from Vite environment variables (added via the UI Secrets panel)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "DUMMY_KEY_FOR_INIT",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy-app-id"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };

// ==========================================
// MỚI: CÁC TIỆN ÍCH LỖI FIRESTORE CHUẨN SECURITY RULES SKILL
// ==========================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// MỚI: CÁC HÀM CRUD THEO KIẾN TRÚC MỚI (CHƯA THAY THẾ STORE CŨ)
// ==========================================

export const dbService = {
  // --- USERS CORE (Profile) ---
  getUserProfile: async (uid: string) => {
    const docRef = doc(db, `users/${uid}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  },
  
  updateUserProfile: async (uid: string, data: any) => {
    // IDEMPOTENT GUARD: Prevent Profile Wiping
    // Do not allow wiping of core profile fields with empty or uninitialized data
    if ("name" in data && (!data.name || data.name.trim() === "")) {
      console.warn(`[dbService] Blocked empty string for display_name update on user ${uid}.`);
      delete data.name;
    }
    if ("role" in data && !data.role) {
      console.warn(`[dbService] Blocked empty role down-grade for user ${uid}.`);
      delete data.role;
    }
    if ("photoURL" in data && data.photoURL === "") {
      console.warn(`[dbService] Blocked empty avatar for user ${uid}.`);
      delete data.photoURL;
    }
    if ("points" in data && (typeof data.points !== "number" || isNaN(data.points))) {
      console.warn(`[dbService] Blocked NaN/invalid mastery_points for user ${uid}.`);
      delete data.points;
    }
    
    // If the entire payload was stripped because it was invalid/empty, abort immediately
    if (Object.keys(data).length === 0) {
       console.error(`[dbService] CRITICAL: update payload for ${uid} is entirely empty or corrupted. Aborting outbound transaction.`);
       // Emit an event to force "Cloud-First Hydration" in the frontend
       if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent("henosis-force-hydration"));
       }
       return;
    }

    const docRef = doc(db, `users/${uid}`);
    await setDoc(docRef, data, { merge: true });
  },

  updateApiToggles: async (payload: any) => {
    const docRef = doc(db, 'system_config/api_toggles');
    await setDoc(docRef, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
  },

  deleteUserProfile: async (uid: string) => {
    // 1. Delete main user profile doc
    const userDocRef = doc(db, `users/${uid}`);
    await deleteDoc(userDocRef);

    // 2. Delete card states subcollection docs
    const cardStatesCol = collection(db, `users/${uid}/cardsState`);
    const cardStatesSnap = await getDocs(cardStatesCol);
    for (const cardDoc of cardStatesSnap.docs) {
      await deleteDoc(doc(db, `users/${uid}/cardsState/${cardDoc.id}`));
    }

    // 3. Remove user from all study groups' members lists
    const groupsCol = collection(db, "groups");
    const groupsSnap = await getDocs(groupsCol);
    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data();
      if (gData.members && Array.isArray(gData.members) && gData.members.includes(uid)) {
        await updateDoc(doc(db, "groups", groupDoc.id), {
          members: arrayRemove(uid)
        });
      }
    }
  },

  // --- PREFERENCES ---
  updatePreferences: async (uid: string, prefs: any) => {
    const docRef = doc(db, `users/${uid}/preferences/main`);
    await setDoc(docRef, prefs, { merge: true });
  },

  // --- CARDS STATE (Mastery) ---
  setCardState: async (uid: string, cardId: string, state: any) => {
    const docRef = doc(db, `users/${uid}/cardsState/${cardId}`);
    await setDoc(docRef, state, { merge: true });
  },
  
  getCardState: async (uid: string, cardId: string) => {
    const docRef = doc(db, `users/${uid}/cardsState/${cardId}`);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  },

  getAllCardStates: async (uid: string) => {
    const colRef = collection(db, `users/${uid}/cardsState`);
    const snap = await getDocs(colRef);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // --- PROGRESS ---
  updateProgress: async (uid: string, progressUpdates: any) => {
    const docRef = doc(db, `users/${uid}/progress/main`);
    await setDoc(docRef, progressUpdates, { merge: true });
  },

  // --- RESOURCES (Google Drive Static URLs) ---
  addResource: async (name: string, type: string, driveUrl: string) => {
    const docRef = await addDoc(collection(db, "resources"), { name, type, driveUrl });
    return docRef.id;
  }
};

// ==========================================
// CENTRALIZED FIREBASE LISTENER MANAGER
// ==========================================

/**
 * A utility class to centrally store and clean up active Firebase
 * onSnapshot listeners. This prevents memory leaks across component 
 * mounting, hot-reloading, or page navigation.
 */
export class FirebaseListenerManager {
  private static listeners = new Map<string, () => void>();

  static add(id: string, unsubscribe: () => void) {
    // If a listener with the same id exists, unsubscribe it first to prevent duplicates
    if (this.listeners.has(id)) {
      this.listeners.get(id)!();
    }
    this.listeners.set(id, unsubscribe);
  }

  static remove(id: string) {
    if (this.listeners.has(id)) {
      this.listeners.get(id)!();
      this.listeners.delete(id);
    }
  }

  static clearAll() {
    this.listeners.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing listener:', error);
      }
    });
    this.listeners.clear();
  }
}
