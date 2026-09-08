
'use client';

import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, type User, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  getFirestore, 
  Firestore 
} from 'firebase/firestore';

// 환경 변수에서 Firebase 설정값을 가져옵니다.
// NEXT_PUBLIC_ 접두사가 붙어야 브라우저에서 안전하게 읽을 수 있습니다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (typeof window !== 'undefined') {
  // 필수 설정값이 있는지 검사합니다.
  const missingKeys = Object.entries(firebaseConfig)
    .filter(([key, value]) => !value && key !== 'storageBucket' && key !== 'messagingSenderId')
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);

  if (missingKeys.length > 0) {
    console.error("❌ [설정 오류] Firebase 키가 누락되었습니다. 호스팅 관리 화면(환경 변수 설정)에서 다음 항목을 추가해주세요:", missingKeys.join(", "));
  }
  
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // Firestore IndexedDB 영구 캐시 설정: 첫 방문 이후 모든 데이터를 로컬에서 밀리초 단위로 초고속 로드
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      // 이미 초기화된 인스턴스가 존재할 경우
      db = getFirestore(app);
    }

    auth = getAuth(app);
    
    // 아이폰 사파리 및 모바일 브라우저 호환성을 위해 인증 지속성을 명시적으로 Local로 설정합니다.
    setPersistence(auth, browserLocalPersistence).catch(err => {
        console.warn("인증 지속성 설정 실패(비로그인 모드 작동):", err);
    });
  } catch (error) {
    console.error("❌ Firebase 초기화 실패:", error);
    app = null as any;
    db = null as any;
    auth = null as any;
  }
} else {
  // 서버 사이드 렌더링 환경 처리
  app = null as any;
  db = null as any;
  auth = null as any;
}

let authUser: User | null = null;

/**
 * @fileOverview Firebase 익명 로그인을 수행합니다.
 * 아이폰 사파리 등에서 hanging 현상을 방지하기 위해 로직을 최적화했습니다.
 */
const signIn = async (): Promise<User> => {
    if (!auth) {
        const errorMsg = "로그인 서버 연결 실패. 환경 변수 설정을 확인해 주세요.";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    // 이미 로그인된 상태라면 즉시 현재 사용자 반환
    if (auth.currentUser) {
        authUser = auth.currentUser;
        return auth.currentUser;
    }

    try {
        // 익명 로그인 수행
        const userCredential = await signInAnonymously(auth);
        authUser = userCredential.user;
        return userCredential.user;
    } catch (error: any) {
        console.error("Anonymous sign-in failed:", error);
        // 사파리 개인정보 보호 모드 등에서 발생할 수 있는 에러 처리
        if (error.code === 'auth/operation-not-allowed') {
            alert("Firebase 콘솔에서 익명 로그인이 활성화되지 않았습니다.");
        } else {
            alert("로그인 중 오류가 발생했습니다. 브라우저 설정을 확인하거나 일반 모드로 접속해주세요.");
        }
        throw error;
    }
};

export { app, db, auth, signIn, authUser };
