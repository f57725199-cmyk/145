import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, deleteDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { getDatabase, ref, set, get, onValue, update, remove } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- NEW FIREBASE CONFIGURATION (CORRECTED) ---
const firebaseConfig = {
  apiKey: "AIzaSyAKuIGYmyo4sDbz3ET5zpZmCH5AnQASZxI",
  authDomain: "jan2025-f69a8.firebaseapp.com",
  projectId: "jan2025-f69a8",
  storageBucket: "jan2025-f69a8.firebasestorage.app",
  messagingSenderId: "158470334860",
  appId: "1:158470334860:web:e67ac809060da43da3cea9",
  // Maine Project ID ke hisab se URL add kiya hai. Iske bina RTDB nahi chalega.
  databaseURL: "https://jan2025-f69a8-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTED HELPERS ---

export const checkFirebaseConnection = () => {
  return true; 
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- DUAL WRITE / SMART READ LOGIC ---

// 1. User Data Sync
export const saveUserToLive = async (user: any) => {
  try {
    if (!user || !user.id) return;
    
    // 1. RTDB (Fastest)
    const userRef = ref(rtdb, `users/${user.id}`);
    await set(userRef, user);
    
    // 2. Firestore (Backup)
    await setDoc(doc(db, "users", user.id), user);
  } catch (error) {
    console.error("Error saving user:", error);
  }
};

// ** FIXED: Listens to RTDB directly so Admin sees new users instantly **
export const subscribeToUsers = (callback: (users: any[]) => void) => {
  const usersRef = ref(rtdb, 'users');
  return onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList = data ? Object.values(data) : [];
      callback(userList);
  }, (error) => {
      console.error("RTDB Subscription Error:", error);
  });
};

export const getUserData = async (userId: string) => {
    try {
        // Try RTDB First
        const snap = await get(ref(rtdb, `users/${userId}`));
        if (snap.exists()) return snap.val();
        
        // Try Firestore
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) return docSnap.data();

        return null;
    } catch (e) { console.error(e); return null; }
};

export const getUserByEmail = async (email: string) => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null; 
    } catch (e) { console.error(e); return null; }
};

// 2. System Settings Sync
export const saveSystemSettings = async (settings: any) => {
  try {
    await set(ref(rtdb, 'system_settings'), settings);
    await setDoc(doc(db, "config", "system_settings"), settings);
  } catch (error) {
    console.error("Error saving settings:", error);
  }
};

export const subscribeToSettings = (callback: (settings: any) => void) => {
  const settingsRef = ref(rtdb, 'system_settings');
  return onValue(settingsRef, (snapshot) => {
       const data = snapshot.val();
       if (data) callback(data);
  }, (error) => {
      // Fallback
      getDoc(doc(db, "config", "system_settings")).then(docSnap => {
        if (docSnap.exists()) callback(docSnap.data());
      });
  });
};

// 3. Content Links Sync
export const bulkSaveLinks = async (updates: Record<string, any>) => {
  try {
    await update(ref(rtdb, 'content_links'), updates);
    const batchPromises = Object.entries(updates).map(async ([key, data]) => {
         await setDoc(doc(db, "content_data", key), data);
    });
    await Promise.all(batchPromises);
  } catch (error) {
    console.error("Error bulk saving links:", error);
  }
};

// 4. Chapter Data Sync
export const saveChapterData = async (key: string, data: any) => {
  try {
    await set(ref(rtdb, `content_data/${key}`), data);
    await setDoc(doc(db, "content_data", key), data);
  } catch (error) {
    console.error("Error saving chapter data:", error);
  }
};

export const getChapterData = async (key: string) => {
    try {
        const snapshot = await get(ref(rtdb, `content_data/${key}`));
        if (snapshot.exists()) return snapshot.val();
        
        const docSnap = await getDoc(doc(db, "content_data", key));
        if (docSnap.exists()) return docSnap.data();
        
        return null;
    } catch (error) { return null; }
};

export const subscribeToChapterData = (key: string, callback: (data: any) => void) => {
    const rtdbRef = ref(rtdb, `content_data/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) callback(snapshot.val());
    });
};

export const saveTestResult = async (userId: string, attempt: any) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        await setDoc(doc(db, "users", userId, "test_results", docId), attempt);
    } catch(e) { console.error(e); }
};

export const updateUserStatus = async (userId: string, time: number) => {
     try {
        const userRef = ref(rtdb, `users/${userId}`);
        await update(userRef, { lastActiveTime: new Date().toISOString() });
    } catch (error) { }
};

export { app, db, rtdb, auth };
