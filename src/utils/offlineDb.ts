import { Deck } from "../lib/store";

const DB_NAME = "HenosisCoursesDB";
const STORE_NAME = "offline_courses";
const DB_VERSION = 3; // Bump version for schema change

export function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB failed to open:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "courseId" });
      }
      if (!db.objectStoreNames.contains("user_profile_meta")) {
        db.createObjectStore("user_profile_meta", { keyPath: "userId" });
      }
    };
  });
}

export async function downloadCourseForOffline(courseId: string): Promise<void> {
  try {
    const { store } = await import("../lib/store");
    const { getDocs, collection, query, where, doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../lib/firebase");
    
    const courseDoc = await getDoc(doc(db, "sets", courseId));
    let courseData: any = null;
    if (courseDoc.exists()) {
      courseData = courseDoc.data();
    } else {
      // Fallback to local store memory
      courseData = store.getDeck(courseId);
      if (!courseData) {
        throw new Error("Course not found");
      }
    }
    
    const currentUser = store.getCurrentUser();
    
    // Fetch mastery states if logged in
    if (currentUser && currentUser.id) {
       const { dbService } = await import("../lib/firebase");
       const states = await dbService.getAllCardStates(currentUser.id);
       const stateMap = new Map();
       states.forEach((s: any) => stateMap.set(s.id, s));
       
       if (courseData.cards && Array.isArray(courseData.cards)) {
         courseData.cards.forEach((card: any) => {
            const savedState = stateMap.get(card.id);
            if (savedState) {
                card.mastery = typeof savedState.mastery === 'number' && !isNaN(savedState.mastery) ? savedState.mastery : (Number(card.mastery) || 0);
                card.nextReviewDate = typeof savedState.nextReviewDate === 'number' ? savedState.nextReviewDate : (typeof savedState.nextReview === 'number' ? savedState.nextReview : card.nextReviewDate);
                card.nextReview = card.nextReviewDate || card.nextReview; // Legacy sync
                card.interval = typeof savedState.interval === 'number' ? savedState.interval : card.interval;
                card.repetitionCount = typeof savedState.repetitionCount === 'number' ? savedState.repetitionCount : (typeof savedState.repetition === 'number' ? savedState.repetition : card.repetitionCount);
                card.easeFactor = typeof savedState.easeFactor === 'number' ? savedState.easeFactor : (typeof savedState.efactor === 'number' ? savedState.efactor : card.easeFactor);
                card.isNewCard = typeof savedState.isNewCard === 'boolean' ? savedState.isNewCard : false;
                card.isHard = typeof savedState.isWeakCard !== 'undefined' ? savedState.isWeakCard : card.isHard;
            }
         });
       }
    }
    
    await saveCourseOffline({
      ...courseData,
      courseId: courseId,
      isAvailableOffline: true
    });
    console.log(`Course ${courseId} downloaded for offline use.`);
  } catch (error) {
    console.error("Error downloading course for offline:", error);
    throw error;
  }
}

export async function saveCourseOffline(course: any): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const storeObj = transaction.objectStore(STORE_NAME);
    const data = {
      ...course,
      courseId: course.courseId || course.id,
      downloadedAt: new Date().toISOString(),
    };
    const request = storeObj.put(data);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Deprecated compat alias
export const saveDeckOffline = saveCourseOffline;

export async function deleteOfflineDeck(deckId: string): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const storeObj = transaction.objectStore(STORE_NAME);
    const request = storeObj.delete(deckId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getOfflineDeck(deckId: string): Promise<Deck | null> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const storeObj = transaction.objectStore(STORE_NAME);
      const request = storeObj.get(deckId);

      request.onsuccess = () => {
        const item = request.result || null;
        if (item) {
          item.id = item.courseId || item.id;
        }
        resolve(item);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to retrieve offline course:", err);
    return null;
  }
}

export async function getAllOfflineDecks(): Promise<Deck[]> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const storeObj = transaction.objectStore(STORE_NAME);
      const request = storeObj.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const filtered = results.filter((item: any) => item.isAvailableOffline === true);
        const standardized = filtered.map((item: any) => ({
          ...item,
          id: item.courseId || item.id
        }));
        resolve(standardized);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to retrieve all offline courses:", err);
    return [];
  }
}

export async function isDeckSavedOffline(deckId: string): Promise<boolean> {
  const deck = await getOfflineDeck(deckId);
  return deck !== null && deck.isAvailableOffline === true;
}

export async function saveProfileMetaOffline(userId: string, profileMeta: any): Promise<void> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("user_profile_meta", "readwrite");
      const storeObj = transaction.objectStore("user_profile_meta");
      const request = storeObj.put({ ...profileMeta, userId });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("Failed to write to IndexedDB profile meta:", e);
  }
}

export async function getProfileMetaOffline(userId: string): Promise<any | null> {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("user_profile_meta", "readonly");
      const storeObj = transaction.objectStore("user_profile_meta");
      const request = storeObj.get(userId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("Failed to read from IndexedDB profile meta:", e);
    return null;
  }
}
