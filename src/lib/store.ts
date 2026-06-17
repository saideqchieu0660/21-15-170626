import { v4 as uuidv4 } from "uuid";
import { safeFetch } from "../utils/safeFetch";

export type Role = "student" | "teacher" | "admin" | "Admin";

export interface User {
  id: string;
  name: string;
  password?: string;
  role: Role;
  points: number; // For weekly ranking
  streak?: number;
  lastActiveDate?: string;
  streakFreeze?: boolean;
  streakFreezeCount?: number;
  isAnonymous?: boolean;
  status?: string;
  isPro?: boolean;
  isSchoolLover?: boolean;
  lastWeeklyResetWeek?: string; // Track which ISO calendar week they reset on
  
  doubleXPUntil?: number; // Timestamp for when the double XP ends
  hideRankUntil?: number; // Timestamp for when the anonymous rank mask ends
  argusEyesUntil?: number; // Timestamp for unlimited Detailed Mode
  achillesUntil?: number; // Timestamp for Achilles High Risk 3x XP multiplier
  
  // Profile UI Upgrades (Optional Fallbacks)
  level?: number;
  avatarBorder?: string;
  photoURL?: string;
  title?: string;
  unlockedCustomTitles?: string[];
  unlockedCustomBorders?: string[];
  
  averageMastery?: number; // Real-time overall average learning mastery (0 - 100)
  top1Weeks?: number; // Số tuần ngự trị ngôi vương Top 1

  activeChallenge?: {
    type: string;
    startDate: string;
    currentMultiplier: number;
    startStreak: number;
    targetDays: number;
    status: 'active' | 'failed' | 'completed';
  } | null;
  unitedEngineUses?: number;
}

export interface Flashcard {
  id: string;
  front: string;
  wordForm?: string; // e.g. noun, verb, adjective
  back: string;
  subject: string;
  mastery: number; // 0 to 100
  nextReview: number; // timestamp
  isHard: boolean; 
  interval?: number; // In days
  easeFactor?: number; // Default 2.5
  repetitionCount?: number; // Total consecutive successful reviews
  isNewCard?: boolean; // True if never reviewed yet
  nextReviewDate?: number; // Timestamp for next review
  originDeckId?: string;
  originDeckTitle?: string;
  example_sentence?: string;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  cardId: string;
  deckTitle: string;
  front: string;
  remembered: boolean;
  masteryChange: number;
  timestamp: number;
}

export interface Deck {
  id: string;
  title: string;
  subject: string;
  cards: Flashcard[];
  createdBy?: string;
  creatorRole?: string;
  creatorName?: string;
  createdAt?: number | string;
}

export interface StudyGroup {
  id: string;
  name: string;
  members: string[]; // user ids
}

let users: User[] = [
  { id: "student_1", name: "Marcus", password: "123", role: "student", points: 42, streak: 5, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_2", name: "Seneca", password: "123", role: "student", points: 28, streak: 2, lastActiveDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: "student_3", name: "Epictetus", password: "123", role: "student", points: 89, streak: 12, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_4", name: "Aurelius", password: "123", role: "student", points: 55, streak: 4, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_5", name: "Zeno", password: "123", role: "student", points: 15, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_6", name: "Cleanthes", password: "123", role: "student", points: 120, streak: 21, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_7", name: "Chrysippus", password: "123", role: "student", points: 76, streak: 8, lastActiveDate: new Date().toISOString().split('T')[0] },
];

let currentUser: User | null = null;
let reviewHistory: ReviewRecord[] = [];

let tempDecks: Record<string, any> = {};

let decks: Deck[] = [
  {
    id: "deck_1",
    title: "Triết Học Khai Tâm",
    subject: "philosophy",
    cards: [
      { id: "card_1", front: "Amor Fati", back: "Yêu lấy định mệnh của mình.", subject: "philosophy", mastery: 95, nextReview: Date.now() + 86400000, isHard: false },
      { id: "card_2", front: "Memento Mori", back: "Hãy nhớ rằng bạn sẽ chết.", subject: "philosophy", mastery: 85, nextReview: Date.now() + 86400000, isHard: false },
    ]
  },
  {
    id: "deck_phil_2",
    title: "Triết Học Nâng Cao",
    subject: "philosophy",
    cards: [
      { id: "card_phil_1", front: "Eudaimonia", back: "Sự thăng hoa, hạnh phúc viên mãn.", subject: "philosophy", mastery: 20, nextReview: Date.now() - 50000, isHard: true },
      { id: "card_phil_2", front: "Prohairesis", back: "Năng lực lựa chọn.", subject: "philosophy", mastery: 10, nextReview: Date.now() - 50000, isHard: true },
    ]
  },
  {
    id: "deck_math_1",
    title: "Toán Dễ (Đại Số)",
    subject: "math",
    cards: [
      { id: "card_math_1", front: "Đạo hàm của x^2", back: "2x", subject: "math", mastery: 90, nextReview: Date.now() + 86400000, isHard: false },
      { id: "card_math_2", front: "Sin(30 độ)", back: "1/2", subject: "math", mastery: 100, nextReview: Date.now() + 86400000, isHard: false },
    ]
  },
  {
    id: "deck_math_2",
    title: "Toán Khó (Tích Phân)",
    subject: "math",
    cards: [
      { id: "card_math_3", front: "Nguyên hàm của cos(x)", back: "sin(x) + C", subject: "math", mastery: 0, nextReview: Date.now() - 10000, isHard: true },
    ]
  },
  {
    id: "deck_physics_1",
    title: "Vật Lý Cơ Bản",
    subject: "science",
    cards: [
      { id: "card_8", front: "Định luật 1 Newton", back: "Một vật đang đứng yên sẽ tiếp tục đứng yên...", subject: "science", mastery: 10, nextReview: Date.now() - 100000, isHard: true },
      { id: "card_9", front: "Công thức lực (Force)", back: "F = ma", subject: "science", mastery: 100, nextReview: Date.now() + 86400000*3, isHard: false },
    ]
  },
  {
    id: "deck_physics_2",
    title: "Vật Lý Lượng Tử",
    subject: "science",
    cards: [
      { id: "card_10", front: "Hằng số Planck", back: "6.626 x 10^-34 J.s", subject: "science", mastery: 0, nextReview: Date.now() - 100000, isHard: true },
    ]
  }
];

let groups: StudyGroup[] = [
  { id: "group_1", name: "Roman Scholars", members: ["student_1", "student_2", "student_4"] },
  { id: "group_2", name: "Physics Masters", members: ["student_3", "student_6", "student_7"] },
  { id: "group_3", name: "Stoic Circle", members: ["student_1", "student_3", "student_5", "student_7"] },
];

export function getISOWeekId(): string {
  const d = new Date();
  d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

const checkAndResetWeeklyPoints = () => {
  const currentWeek = getISOWeekId();
  const lastResetWeek = localStorage.getItem("lastWeeklyResetWeek");
  
  if (lastResetWeek !== currentWeek) {
    // Reset points
    users.forEach(u => {
      u.points = 0;
      u.lastWeeklyResetWeek = currentWeek;
    });
    if (currentUser) {
      currentUser.points = 0;
      currentUser.lastWeeklyResetWeek = currentWeek;
      syncUserToFirebase();
    }
    localStorage.setItem("lastWeeklyResetWeek", currentWeek);
    console.log(`Weekly points have been reset to 0 for week ${currentWeek}.`);
    
    // Kích hoạt dọn dẹp Firestore tự động tuần đầy đủ cho toàn hệ thống
    safeFetch("/api/automation/reset-weekly-points", { method: "POST" })
      .then(r => r.json())
      .then(d => {
        console.log("Auto-Reset Firebase Weekly Points response:", d);
      })
      .catch(err => {
        console.error("Auto-Reset Firebase Weekly Points failed:", err);
      });
  }
};

export function syncLocalUserDecks() {
  const userId = currentUser?.id || "guest";
  const localUserDecksKey = `local_user_decks_${userId}`;
  const savedStr = localStorage.getItem(localUserDecksKey);
  if (savedStr) {
    try {
      const loadedDecks: Deck[] = JSON.parse(savedStr);
      if (Array.isArray(loadedDecks)) {
        const systemDecks = [
          "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
        ];
        decks = decks.filter(d => systemDecks.includes(d.id));
        loadedDecks.forEach(customDeck => {
           if (!decks.some(d => d.id === customDeck.id)) {
              decks.push(customDeck);
           }
        });
      }
    } catch (e) {
      console.error("Failed to sync local user decks:", e);
    }
  } else {
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
    ];
    decks = decks.filter(d => systemDecks.includes(d.id));
  }
}

export function saveLocalUserDecks() {
  const userId = currentUser?.id || "guest";
  const localUserDecksKey = `local_user_decks_${userId}`;
  const systemDecks = [
    "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
  ];
  const userCustomDecks = decks.filter(d => !systemDecks.includes(d.id));
  try {
    localStorage.setItem(localUserDecksKey, JSON.stringify(userCustomDecks));
  } catch (e) {
    console.error("Failed to save local user decks:", e);
  }
}

checkAndResetWeeklyPoints();
try {
  syncLocalUserDecks();
} catch (err) {
  console.warn("Storage not available during module initialization:", err);
}

const updateStreak = (user: User) => {
  const today = new Date().toISOString().split('T')[0];
  if (user.lastActiveDate === today) {
    return;
  }
  if (user.lastActiveDate) {
    const lastActive = new Date(user.lastActiveDate);
    const current = new Date(today);
    const diffDays = Math.round(Math.abs(current.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      user.streak = (user.streak || 0) + 1;
    } else if (diffDays === 2 && user.streakFreeze) {
      user.streakFreeze = false;
      // Streak maintained, not reset, not increased
    } else if (diffDays > 1) {
      if (user.activeChallenge?.status === 'active') {
        user.activeChallenge.status = 'failed';
        user.points = Math.max(0, user.points - (600 * user.activeChallenge.currentMultiplier));
      }
      user.streak = 1;
    }
  } else {
    // If no last active date, streak starts at 1
    if (user.activeChallenge?.status === 'active') {
        user.activeChallenge.status = 'failed';
        user.points = Math.max(0, user.points - (600 * user.activeChallenge.currentMultiplier));
    }
    user.streak = 1;
  }
  user.lastActiveDate = today;

  // Check challenge completion after updating streak
  if (user.activeChallenge?.status === 'active') {
    const target = user.activeChallenge.startStreak + user.activeChallenge.targetDays;
    if ((user.streak || 0) >= target) {
      user.activeChallenge.status = 'completed';
    }
  }
};

export async function syncUserToFirebase() {
  if (currentUser) {
    try {
      // PRE-FLIGHT VALIDATION: Only cache and queue if it's a valid data block
      if (typeof currentUser.points === 'number' && currentUser.role) {
          import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
            saveProfileMetaOffline(currentUser!.id, currentUser).catch(console.warn);
          });
      }
      
      const { auth } = await import('./firebase');
      if (auth.currentUser?.isAnonymous && currentUser.points === 0) return; // Do not sync zero point anonymous users
      
      const payload = {
        name: currentUser.name,
        role: currentUser.role,
        points: currentUser.points,
        streak: currentUser.streak || 1,
        lastActiveDate: currentUser.lastActiveDate || new Date().toISOString().split('T')[0],
        streakFreeze: !!currentUser.streakFreeze,
        streakFreezeCount: currentUser.streakFreezeCount || 0,
        isAnonymous: auth.currentUser?.isAnonymous || false,
        isSchoolLover: !!currentUser.isSchoolLover,
        doubleXPUntil: currentUser.doubleXPUntil || 0,
        hideRankUntil: currentUser.hideRankUntil || 0,
        argusEyesUntil: currentUser.argusEyesUntil || 0,
        achillesUntil: currentUser.achillesUntil || 0,
        averageMastery: currentUser.averageMastery || 0,
        top1Weeks: currentUser.top1Weeks || 0,
        level: currentUser.level || 1,
        avatarBorder: currentUser.avatarBorder || "none",
        title: currentUser.title || "",
        unlockedCustomTitles: currentUser.unlockedCustomTitles || [],
        unlockedCustomBorders: currentUser.unlockedCustomBorders || [],
        photoURL: currentUser.photoURL || "",
        ...(currentUser.activeChallenge && { activeChallenge: currentUser.activeChallenge }),
        ...(currentUser.unitedEngineUses !== undefined && { unitedEngineUses: currentUser.unitedEngineUses })
      };

      import('./offlineSync').then(({ OfflineSyncQueue }) => {
        OfflineSyncQueue.enqueueUserProfile(currentUser!.id, payload);
      }).catch(e => console.error("OfflineSync Profile enqueue error:", e));
    } catch (e) {
      console.error("Failed to sync currentUser to Firebase:", e);
    }
  }
}

export const store = {
  getUsers: () => users,
  getCurrentUser: () => {
    if (currentUser) updateStreak(currentUser);
    return currentUser;
  },
  setFirebaseUser: async (firebaseUser: any) => {
    if (!firebaseUser) {
        currentUser = null;
        return;
    }
    const email = firebaseUser.email || "User";
    const name = email.split('@')[0];
    let u = users.find(x => x.name === name);
    if (!u) {
       let cachedU = null;
       try { 
         const { getProfileMetaOffline } = await import('../utils/offlineDb');
         cachedU = await getProfileMetaOffline(firebaseUser.uid);
       } catch (e) {
         console.warn("Failed to load cached profile from IndexedDB:", e);
       }
       
       if (cachedU && cachedU.role) {
           u = { ...cachedU, id: firebaseUser.uid, name };
       } else {
           u = { id: firebaseUser.uid, name, role: "student", points: 0, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0] };
       }
       users.push(u);
    }
    currentUser = u;
    u.photoURL = firebaseUser.photoURL || u.photoURL || "";

    // Architecture 3: Trích xuất và Hydrate CardState cho user
    try {
        const { dbService, db, handleFirestoreError, OperationType } = await import('./firebase');
        const { collection, getDocs, setDoc, doc } = await import('firebase/firestore');

        // Lấy profile từ Firestore để đồng bộ role, points, streak, lastActiveDate, streakFreeze
        const profile = await dbService.getUserProfile(firebaseUser.uid);
        if (profile) {
            import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
                saveProfileMetaOffline(firebaseUser.uid, profile).catch(console.warn);
            });
            let sessionRole = profile.role || "student";
            if (sessionRole === "Admin" || sessionRole === "admin") {
                sessionStorage.setItem('adminToken', 'true');
            }
            if (sessionRole === "teacher" && sessionStorage.getItem('adminToken') !== 'true') {
                sessionRole = "student";
            }
            if (sessionStorage.getItem('adminToken') === 'true') {
                if (sessionRole !== "Admin" && sessionRole !== "admin") {
                    sessionRole = "teacher";
                }
            }
            if (sessionRole) u.role = sessionRole as any;
            if (typeof profile.isPro === 'boolean') u.isPro = profile.isPro;
            if (typeof profile.isSchoolLover === 'boolean') u.isSchoolLover = profile.isSchoolLover;
            if (profile.title) u.title = profile.title;
            if (profile.avatarBorder) u.avatarBorder = profile.avatarBorder;
            if (profile.photoURL) u.photoURL = profile.photoURL;
            if (profile.unlockedCustomTitles) u.unlockedCustomTitles = profile.unlockedCustomTitles;
            if (profile.unlockedCustomBorders) u.unlockedCustomBorders = profile.unlockedCustomBorders;
            
            // Calendric Weekly Points Reset Check
            const currentWeek = getISOWeekId();
            const lastResetWeek = profile.lastWeeklyResetWeek || "";
            if (lastResetWeek !== currentWeek) {
                u.points = 0;
                u.lastWeeklyResetWeek = currentWeek;
                if (!firebaseUser.isAnonymous) {
                    await dbService.updateUserProfile(firebaseUser.uid, {
                        points: 0,
                        lastWeeklyResetWeek: currentWeek
                    });
                }
                // Đồng thời kích hoạt dọn dẹp Firestore tự động tuần đầy đủ cho toàn hệ thống
                safeFetch("/api/automation/reset-weekly-points", { method: "POST" })
                  .then(r => r.json())
                  .then(d => console.log("System-wide keypoints reset:", d))
                  .catch(err => console.error("System-wide keypoints reset failed:", err));
            } else {
                if (typeof profile.points === 'number') u.points = profile.points;
                if (profile.lastWeeklyResetWeek) u.lastWeeklyResetWeek = profile.lastWeeklyResetWeek;
            }
            
            if (typeof profile.streak === 'number') u.streak = profile.streak;
            if (profile.lastActiveDate) u.lastActiveDate = profile.lastActiveDate;
            if (typeof profile.streakFreeze === 'boolean') u.streakFreeze = profile.streakFreeze;
            if (typeof profile.streakFreezeCount === 'number') u.streakFreezeCount = profile.streakFreezeCount;
            if (typeof profile.doubleXPUntil === 'number') u.doubleXPUntil = profile.doubleXPUntil;
            if (typeof profile.hideRankUntil === 'number') u.hideRankUntil = profile.hideRankUntil;
            if (typeof profile.argusEyesUntil === 'number') u.argusEyesUntil = profile.argusEyesUntil;
            if (typeof profile.achillesUntil === 'number') u.achillesUntil = profile.achillesUntil;
            if (typeof profile.averageMastery === 'number') u.averageMastery = profile.averageMastery;
            if (typeof profile.top1Weeks === 'number') u.top1Weeks = profile.top1Weeks;
            if (profile.activeChallenge) u.activeChallenge = profile.activeChallenge;
            if (typeof profile.unitedEngineUses === 'number') u.unitedEngineUses = profile.unitedEngineUses;
        } else {
            // Chưa có profile trên firestore, lưu quả profile mặc định đầu tiên lên (chỉ người dùng thật)
            if (!firebaseUser.isAnonymous) {
              const currentWeek = getISOWeekId();
              u.lastWeeklyResetWeek = currentWeek;
              await dbService.updateUserProfile(firebaseUser.uid, {
                 name: u.name,
                 role: u.role,
                 points: u.points,
                 streak: u.streak,
                 lastActiveDate: u.lastActiveDate,
                 streakFreeze: !!u.streakFreeze,
                 streakFreezeCount: u.streakFreezeCount || 0,
                 doubleXPUntil: u.doubleXPUntil || 0,
                 hideRankUntil: u.hideRankUntil || 0,
                 isAnonymous: false,
                 isPro: !!u.isPro,
                 lastWeeklyResetWeek: currentWeek
              });
            }
        }

        // Chạy updateStreak lúc đăng nhập một cách an toàn và đồng bộ ngược lên db nếu đổi
        const oldStreak = u.streak;
        updateStreak(u);
        if (u.streak !== oldStreak) {
           if (!firebaseUser.isAnonymous) {
              await dbService.updateUserProfile(firebaseUser.uid, {
                 streak: u.streak,
                 lastActiveDate: u.lastActiveDate
              });
           }
        }

        // Hydrate Sets from Firestore
        try {
            const setsCol = collection(db, "sets");
            let setsSnapshot = await getDocs(setsCol);
            
            if (setsSnapshot.empty) {
                // Seed standard static decks into Firestore
                const defaultDecks = [
                  {
                    id: "deck_1",
                    title: "Triết Học Khai Tâm",
                    subject: "philosophy",
                    cards: [
                      { id: "card_1", front: "Amor Fati", back: "Yêu lấy định mệnh của mình.", subject: "philosophy", mastery: 95, nextReview: Date.now() + 86400000, isHard: false },
                      { id: "card_2", front: "Memento Mori", back: "Hãy nhớ rằng bạn sẽ chết.", subject: "philosophy", mastery: 85, nextReview: Date.now() + 86400000, isHard: false },
                    ]
                  },
                  {
                    id: "deck_phil_2",
                    title: "Triết Học Nâng Cao",
                    subject: "philosophy",
                    cards: [
                      { id: "card_phil_1", front: "Eudaimonia", back: "Sự thăng hoa, hạnh phúc viên mãn.", subject: "philosophy", mastery: 20, nextReview: Date.now() - 50000, isHard: true },
                      { id: "card_phil_2", front: "Prohairesis", back: "Năng lực lựa chọn.", subject: "philosophy", mastery: 10, nextReview: Date.now() - 50000, isHard: true },
                    ]
                  },
                  {
                    id: "deck_math_1",
                    title: "Toán Dễ (Đại Số)",
                    subject: "math",
                    cards: [
                      { id: "card_math_1", front: "Đạo hàm của x^2", back: "2x", subject: "math", mastery: 90, nextReview: Date.now() + 86400000, isHard: false },
                      { id: "card_math_2", front: "Sin(30 độ)", back: "1/2", subject: "math", mastery: 100, nextReview: Date.now() + 86400000, isHard: false },
                    ]
                  },
                  {
                    id: "deck_math_2",
                    title: "Toán Khó (Tích Phân)",
                    subject: "math",
                    cards: [
                      { id: "card_math_3", front: "Nguyên hàm của cos(x)", back: "sin(x) + C", subject: "math", mastery: 0, nextReview: Date.now() - 10000, isHard: true },
                    ]
                  },
                  {
                    id: "deck_physics_1",
                    title: "Vật Lý Cơ Bản",
                    subject: "science",
                    cards: [
                      { id: "card_8", front: "Định luật 1 Newton", back: "Một vật đang đứng yên sẽ tiếp tục đứng yên...", subject: "science", mastery: 10, nextReview: Date.now() - 100000, isHard: true },
                      { id: "card_9", front: "Công thức lực (Force)", back: "F = ma", subject: "science", mastery: 100, nextReview: Date.now() + 86400000*3, isHard: false },
                    ]
                  },
                  {
                    id: "deck_physics_2",
                    title: "Vật Lý Lượng Tử",
                    subject: "science",
                    cards: [
                      { id: "card_10", front: "Hằng số Planck", back: "6.626 x 10^-34 J.s", subject: "science", mastery: 0, nextReview: Date.now() - 100000, isHard: true },
                    ]
                  }
                ];

                for (const d of defaultDecks) {
                    await setDoc(doc(db, "sets", d.id), d);
                }
                setsSnapshot = await getDocs(setsCol);
            }

            const fbDecks: Deck[] = [];
            setsSnapshot.forEach(docSnap => {
                const deckData = docSnap.data() as any;
                if (deckData && Array.isArray(deckData.cards)) {
                    deckData.cards = deckData.cards.map((c: any) => ({
                        ...c,
                        mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
                    }));
                }
                
                const systemDecks = [
                  "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2"
                ];
                const isSystem = systemDecks.includes(deckData.id);
                const isCreatedBySelf = deckData.createdBy === u.id;
                const isCreatedByTeacher = deckData.creatorRole === "teacher" || deckData.creatorRole === "Admin" || deckData.creatorRole === "admin";
                
                const isUserTeacher = u.role === "teacher" || u.role === "Admin" || u.role === "admin";

                // Personal decks should only be loaded/visible if system deck, created by self, creator is admin/teacher, or logged-in user is admin/teacher.
                if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
                  fbDecks.push(deckData as Deck);
                }
            });
            if (fbDecks.length > 0) {
                decks = fbDecks;
            }
        } catch (setErr) {
            console.error("Failed to load sets from Firestore, fallback to static decks", setErr);
        }

        const states = await dbService.getAllCardStates(firebaseUser.uid);
        if (states && states.length > 0) {
            const stateMap = new Map();
            states.forEach((s: any) => stateMap.set(s.id, s));
            
            // Loop through default local decks and update flashcards memory
            decks.forEach(deck => {
                deck.cards.forEach(card => {
                    const savedState = stateMap.get(card.id);
                    if (savedState) {
                        card.mastery = typeof savedState.mastery === 'number' && !isNaN(savedState.mastery) ? savedState.mastery : (Number(card.mastery) || 0);
                        card.nextReviewDate = typeof savedState.nextReviewDate === 'number' ? savedState.nextReviewDate : (typeof savedState.nextReview === 'number' ? savedState.nextReview : card.nextReviewDate);
                        card.nextReview = card.nextReviewDate || card.nextReview; // Legacy sync
                        card.interval = typeof savedState.interval === 'number' ? savedState.interval : card.interval;
                        card.repetitionCount = typeof savedState.repetitionCount === 'number' ? savedState.repetitionCount : (typeof savedState.repetition === 'number' ? savedState.repetition : card.repetitionCount);
                        card.easeFactor = typeof savedState.easeFactor === 'number' ? savedState.easeFactor : (typeof savedState.efactor === 'number' ? savedState.efactor : card.easeFactor);
                        card.isNewCard = typeof savedState.isNewCard === 'boolean' ? savedState.isNewCard : false; // If it's saved in state it's no longer new
                        card.isHard = typeof savedState.isWeakCard !== 'undefined' ? savedState.isWeakCard : card.isHard;
                    }
                });
            });
        }
    } catch (e: any) {
        if (!navigator.onLine || e?.message?.includes('client is offline') || e?.message?.includes('Failed to load sets from Firestore')) {
            console.warn("Firebase client is offline: loading offline courses from IndexedDB.");
            try {
                const { getAllOfflineDecks } = await import('../utils/offlineDb');
                const offlineCourses = await getAllOfflineDecks();
                if (offlineCourses.length > 0) {
                    decks = offlineCourses;
                }
            } catch (err) {
                console.error("Failed to load offline courses:", err);
            }
        } else {
            console.error("Failed to hydrate cards state from Firebase:", e);
        }
    }
    syncLocalUserDecks();
    // Kích hoạt đồng bộ các thay đổi offline tích lũy của user nếu có
    import('./offlineSync').then(({ OfflineSyncQueue }) => {
        OfflineSyncQueue.processQueue();
    }).catch(err => console.error("Error trigger queue processing during setFirebaseUser:", err));
  },
  logout: () => { 
    currentUser = null; 
    sessionStorage.removeItem('adminToken');
    syncLocalUserDecks();
  },
  updateCurrentUser: (updates: Partial<User>, skipSync?: boolean) => {
    if (currentUser) {
      currentUser = { ...currentUser, ...updates };
      const idx = users.findIndex(u => u.id === currentUser?.id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updates };
      }
      import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
          saveProfileMetaOffline(currentUser!.id, currentUser).catch(console.warn);
      });
      if (!skipSync) {
        syncUserToFirebase();
      }
      
      // Global UI Reactive State Event to force-trigger DOM re-renders across the app
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
        window.dispatchEvent(new CustomEvent("user-cosmetics-updated"));
      }
    }
  },
  signup: (name: string, password: string, adminKey?: string) => {
    if (users.find(x => x.name === name)) return null; // already exists
    
    let role: Role = "student";
    let isPro = false;
    const correctAdminKey = "disabled_in_client_use_backend";
    const proKey = "disabled_in_client_use_backend_pro";
    if (adminKey && adminKey === correctAdminKey) {
       role = "teacher";
    } else if (adminKey && adminKey === proKey) {
       isPro = true;
    }

    const u: User = { id: `user_${uuidv4()}`, name, password, role, isPro, points: 0, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0] };
    users.push(u);
    currentUser = u;
    syncLocalUserDecks();
    return u;
  },
  login: (name: string, password?: string, adminKey?: string) => {
    let u = users.find(x => x.name === name);
    
    if (u && password && u.password !== password) {
      return null; // invalid password
    }

    if (u) {
       // if they provided correct admin key, upgrade them
       const correctAdminKey = "disabled_in_client_use_backend";
       const proKey = "disabled_in_client_use_backend_pro";
       if (adminKey && adminKey === correctAdminKey) {
          u.role = "teacher";
       } else if (adminKey && adminKey === proKey) {
          u.isPro = true;
       }
       currentUser = u;
       syncLocalUserDecks();
     }
    
    return u;
  },
  getDecks: () => {
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"
    ];
    if (!currentUser) {
      return decks.filter(d => systemDecks.includes(d.id));
    }
    const isUserTeacher = currentUser.role === "teacher" || currentUser.role === "Admin" || currentUser.role === "admin";
    
    return decks.filter(d => {
      const isSystem = systemDecks.includes(d.id);
      if (isSystem) return true;
      
      const isCreatedBySelf = d.createdBy === currentUser.id;
      const isCreatedByTeacher = d.creatorRole === "teacher" || d.creatorRole === "Admin" || d.creatorRole === "admin";
      
      // Admin/Teacher can see everything.
      // Creator can see their own.
      // Official teacher/admin-created decks can be loaded by students to study.
      // Student-created personal decks are STRICTLY private (only self & admin/teacher can load/view).
      if (isUserTeacher || isCreatedBySelf || isCreatedByTeacher) {
        return true;
      }
      return false;
    });
  },
  setTempDeck: (deck: any) => {
    tempDecks[deck.id] = deck;
    decks = decks.filter(d => d.id !== deck.id);
    decks.push(deck);
  },
  getRawDeckTitle: (id: string) => {
    const d = tempDecks[id] || decks.find(d => d.id === id);
    return d ? d.title : undefined;
  },
  getDeck: (id: string) => {
    const d = tempDecks[id] || decks.find(d => d.id === id);
    if (!d) return undefined;
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "daily-quest", "remind-later-deck"
    ];
    if (systemDecks.includes(d.id)) return d;
    if (!currentUser) return undefined;
    const isUserTeacher = currentUser.role === "teacher" || currentUser.role === "Admin" || currentUser.role === "admin";
    const isCreatedBySelf = d.createdBy === currentUser.id;
    const isCreatedByTeacher = d.creatorRole === "teacher" || d.creatorRole === "Admin" || d.creatorRole === "admin";
    if (isUserTeacher || isCreatedBySelf || isCreatedByTeacher) {
      return d;
    }
    return undefined;
  },
  addDeck: async (deck: Deck) => {
    const creatorId = currentUser?.id || "guest";
    const creatorRole = currentUser?.role || "student";
    const creatorNameVal = currentUser?.name || "Người dùng";
    
    const deckWithCreator = {
      ...deck,
      createdBy: (deck as any).createdBy || creatorId,
      creatorRole: (deck as any).creatorRole || creatorRole,
      creatorName: (deck as any).creatorName || creatorNameVal
    };

    if (!decks.some(d => d.id === deckWithCreator.id)) {
      decks.push(deckWithCreator);
    } else {
      decks = decks.map(d => d.id === deckWithCreator.id ? deckWithCreator : d);
    }
    saveLocalUserDecks();
    try {
      const { db } = await import("./firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sets", deck.id), {
        id: deck.id,
        title: deck.title,
        subject: deck.subject,
        cards: deck.cards,
        createdBy: deckWithCreator.createdBy,
        creatorRole: deckWithCreator.creatorRole,
        creatorName: deckWithCreator.creatorName
      });
    } catch (e) {
      console.warn("Failed to add deck/set to Firestore (expected on free plan):", e);
    }
  },
  deleteDeckLocally: (deckId: string) => {
    decks = decks.filter(d => d.id !== deckId);
    if (tempDecks[deckId]) {
      delete tempDecks[deckId];
    }
    saveLocalUserDecks();
  },
  setDecksLocally: (newDecks: Deck[]) => {
    decks = [...newDecks];
    // Re-inject all active transient decks so getDecks() stays in sync
    Object.values(tempDecks).forEach(tempDeck => {
      if (!decks.some(d => d.id === tempDeck.id)) {
        decks.push(tempDeck);
      }
    });
    saveLocalUserDecks();
  },
  addCardLocally: (deckId: string, card: Flashcard) => {
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      if (!deck.cards.some(c => c.id === card.id)) {
        deck.cards.push(card);
        saveLocalUserDecks();
      }
    }
  },
  removeCardLocally: (deckId: string, cardId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      deck.cards = deck.cards.filter(c => c.id !== cardId);
      saveLocalUserDecks();
    }
  },
  buyStreakFreeze: (customPrice?: number) => {
    const price = customPrice !== undefined ? customPrice : 400 * Math.pow(2, currentUser?.streakFreezeCount || 0);
    if (currentUser && currentUser.points >= price && !currentUser.streakFreeze) {
      currentUser.points -= price;
      currentUser.streakFreeze = true;
      currentUser.streakFreezeCount = (currentUser.streakFreezeCount || 0) + 1;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyXPPotion: (price: number = 150, xpEarned: number = 50) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points = currentUser.points - price + xpEarned;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyLevelUp: (price: number = 600) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      // Calculate current level and add 1
      const currentLevel = currentUser.level || Math.max(1, Math.floor(Math.sqrt(Math.max(0, currentUser.points) / 50)) + 1);
      currentUser.level = currentLevel + 1;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyDoubleXP: (price: number = 250) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.doubleXPUntil = Date.now() + 15 * 60 * 1000;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyHideRank: (price: number = 200) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.hideRankUntil = Date.now() + 24 * 60 * 60 * 1000;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyArgusEyes: (price: number = 300) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.argusEyesUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  activateAchillesBuff: () => {
    if (currentUser) {
      currentUser.achillesUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      currentUser.points += 1; // Nhận thêm 1 pt (achilles pt hoặc Tinh Hoa)
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  deductPoints: (amount: number) => {
    if (currentUser && currentUser.points >= amount) {
       currentUser.points -= amount;
       syncUserToFirebase();
       return true;
    }
    return false;
  },
  breakAchillesStreak: () => {
    if (currentUser) {
      // Penalty: Reset streak to 0, subtract points equivalent to a level if possible
      currentUser.streak = 0;
      delete (currentUser as any).lastStreakDate;
      syncUserToFirebase();
    }
  },
  buyAdminRole: (price: number = 99999999999) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.role = "Admin";
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  addBonusPoints: (points: number) => {
    if (currentUser) {
        const isDoubleXP = currentUser.doubleXPUntil && currentUser.doubleXPUntil > Date.now();
        const isAchilles = currentUser.achillesUntil && currentUser.achillesUntil > Date.now();
        let multiplier = 1;
        if (isAchilles) multiplier = 4;
        else if (isDoubleXP) multiplier = 2;
        currentUser.points += points * multiplier;
        syncUserToFirebase();
    }
  },
  updateCardMastery: (deckId: string, cardId: string, remembered: boolean) => {
     let deck = decks.find(d => d.id === deckId) || tempDecks[deckId];
     
     // Fallback: search across all available decks in tempDecks if originDeckId was grouped
     if (!deck) {
         deck = Object.values(tempDecks).find((d: any) => d.id === deckId);
     }
     
     // Deep Fallback: search across all decks to find the actual card
     if (!deck) {
         deck = decks.find(d => d.cards.some((c: any) => c.id === cardId));
         if (!deck) {
             deck = Object.values(tempDecks).find((d: any) => d.cards.some((c: any) => c.id === cardId));
         }
     }
     
     if (!deck) return;
     const card = deck.cards.find((c: any) => c.id === cardId);
     if (!card) return;

     const oldMastery = card.mastery;

     // SuperMemo-2 Spaced Repetition Logic
     let quality = remembered ? 4 : 1; 
     let rep = card.repetitionCount || 0;
     let ef = card.easeFactor || 2.5;
     let inter = card.interval || 0;

     if (remembered) {
         if (rep === 0) {
             inter = 1;
         } else if (rep === 1) {
             inter = 6;
         } else {
             inter = Math.round(inter * ef);
         }
         rep += 1;
         
         card.mastery = Math.min(100, card.mastery + 20);
         card.isHard = false;
         if (currentUser) {
             const isDoubleXP = currentUser.doubleXPUntil && currentUser.doubleXPUntil > Date.now();
             const isAchilles = currentUser.achillesUntil && currentUser.achillesUntil > Date.now();
             let multiplier = 1;
             if (isAchilles) multiplier = 4;
             else if (isDoubleXP) multiplier = 2;
             
             // ANTI-SPAM MECHANISM: Ngăn cày điểm bằng cách giới hạn 2 tiếng/mỗi thẻ mới có điểm
             const twoHours = 2 * 60 * 60 * 1000;
             const canEarnPoints = !card.lastPointAwarded || (Date.now() - card.lastPointAwarded >= twoHours);
             
             if (canEarnPoints) {
                 currentUser.points += multiplier;
                 card.lastPointAwarded = Date.now();
                 import('./offlineSync').then(({ OfflineSyncQueue }) => {
                    OfflineSyncQueue.enqueuePointsDelta(currentUser!.id, multiplier);
                 }).catch(e => console.error("OfflineSync Points enqueue error:", e));
             }
         }
     } else {
         rep = 0;
         inter = 1;
         card.mastery = Math.max(0, card.mastery - 20);
         card.isHard = true;
         if (currentUser && currentUser.achillesUntil && currentUser.achillesUntil > Date.now()) {
             if (currentUser.streak && currentUser.streak > 1) {
                 currentUser.streak = 1;
                 import('./offlineSync').then(({ OfflineSyncQueue }) => {
                    OfflineSyncQueue.enqueueUserProfile(currentUser!.id, { streak: 1 });
                 });
             } else if (currentUser.level && currentUser.level > 1) {
                 currentUser.level -= 1;
                 import('./offlineSync').then(({ OfflineSyncQueue }) => {
                    OfflineSyncQueue.enqueueUserProfile(currentUser!.id, { level: currentUser!.level });
                 });
             }
         }
     }

     ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
     if (ef < 1.3) ef = 1.3;

     card.repetitionCount = rep;
     card.easeFactor = ef;
     card.interval = inter;
     card.isNewCard = false;
     card.nextReviewDate = Date.now() + (inter * 86400000); // interval to milliseconds

     const masteryChange = card.mastery - oldMastery;

     if (currentUser && currentUser.id) {
         // Sync to Firestore Architecture 3. users/{uid}/cardsState/{cardId}
         const payload = {
             mastery: card.mastery,
             nextReviewDate: card.nextReviewDate, // updated
             nextReview: card.nextReviewDate, // legacy support fallback
             interval: card.interval,
             repetitionCount: card.repetitionCount,
             easeFactor: card.easeFactor,
             isNewCard: card.isNewCard,
             isWeakCard: card.isHard,
             lastPointAwarded: card.lastPointAwarded
         };

         import('./offlineSync').then(({ OfflineSyncQueue }) => {
            OfflineSyncQueue.enqueueCardState(currentUser!.id, card.id, payload);
         }).catch(e => console.error("OfflineSync CardState enqueue error:", e));
         
         if (currentUser) {
             const today = new Date().toISOString().split('T')[0];
             const key = `daily_reviewed_${currentUser.id}_${today}`;
             const currentReviewed = parseInt(localStorage.getItem(key) || "0", 10);
             localStorage.setItem(key, (currentReviewed + 1).toString());

             reviewHistory.push({
               id: uuidv4(),
               userId: currentUser.id,
               cardId: card.id,
               deckTitle: deck.title,
               front: card.front,
               remembered,
               masteryChange,
               timestamp: Date.now()
             });
         }
     }
  },
  getReviewHistory: (userId: string) => {
     return reviewHistory.filter(r => r.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  },
  getGroups: () => groups,
  updateCard: (deckId: string, cardId: string, front: string, back: string, example_sentence?: string) => {
     const deck = decks.find(d => d.id === deckId);
     if (!deck) return;
     const card = deck.cards.find(c => c.id === cardId);
     if (!card) return;
     card.front = front;
     if (example_sentence !== undefined) {
        card.example_sentence = example_sentence;
     }
     card.back = back;
     saveLocalUserDecks();
  },
  removeDeckLocally: (deckId: string) => {
     decks = decks.filter(d => d.id !== deckId);
     saveLocalUserDecks();
  },
  createGroup: (name: string) => {
    let g = { id: `grp_${uuidv4().substring(0, 8)}`, name, members: currentUser ? [currentUser.id] : [] };
    groups.push(g);
    return g;
  },
  joinGroup: (id: string) => {
    let g = groups.find(x => x.id === id);
    if (g && currentUser && !g.members.includes(currentUser.id)) {
      g.members.push(currentUser.id);
    }
    return g;
  },
  getISOWeekId: () => getISOWeekId()
};
