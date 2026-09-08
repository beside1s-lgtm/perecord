import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, getDocs, setDoc, query, where, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function runBenchmark() {
  console.log("=== 성능 벤치마크 시작 ===");
  const authStart = performance.now();
  const userCredential = await signInAnonymously(auth);
  console.log(`1. 인증 소요 시간: ${(performance.now() - authStart).toFixed(1)}ms`);

  // 등록된 학교 조회
  const schoolsSnap = await getDocs(collection(db, 'schools'));
  const schools = schoolsSnap.docs.map(d => d.id);
  console.log(`2. 등록된 학교 목록: ${schools.join(', ')}`);

  const school = schools[0] || '테스트초등학교';
  console.log(`\n--- 대상 학교: [${school}] 데이터 로딩 성능 측정 ---`);

  // 1) 학생 데이터 조회 시간 측정
  const studentStart = performance.now();
  const studentsSnap = await getDocs(collection(db, 'schools', school, 'students'));
  const studentTime = (performance.now() - studentStart).toFixed(1);
  console.log(`학생 목록 로딩: ${studentsSnap.size}명 문서 읽기 -> ${studentTime}ms`);

  // 2) 기록 데이터 조회 시간 측정
  const recordStart = performance.now();
  const recordsSnap = await getDocs(collection(db, 'schools', school, 'records'));
  const recordTime = (performance.now() - recordStart).toFixed(1);
  console.log(`기록 데이터 로딩: ${recordsSnap.size}건 문서 읽기 -> ${recordTime}ms`);

  // 3) 단건 저장 벤치마크 비교
  console.log(`\n--- 1명 데이터 저장 속도 비교 테스트 ---`);
  const testStudentId = studentsSnap.docs[0]?.id || 'test_student_1';
  const testItem = '50m 달리기';
  const testDate = '2026-08-30';
  const testValue = 8.5;

  // A. 기존 방식 (ID 없이 3개 조건 where 쿼리 getDocs 후 쓰기)
  const legacyStart = performance.now();
  const q = query(
    collection(db, 'schools', school, 'records'),
    where('studentId', '==', testStudentId),
    where('item', '==', testItem),
    where('date', '==', testDate),
    limit(1)
  );
  const qSnap = await getDocs(q);
  let savedDocId;
  if (!qSnap.empty) {
    savedDocId = qSnap.docs[0].id;
    await setDoc(doc(db, 'schools', school, 'records', savedDocId), { value: testValue, updatedAt: Date.now() }, { merge: true });
  } else {
    const newDocRef = doc(collection(db, 'schools', school, 'records'));
    savedDocId = newDocRef.id;
    await setDoc(newDocRef, { studentId: testStudentId, school, item: testItem, date: testDate, value: testValue });
  }
  const legacyTime = (performance.now() - legacyStart).toFixed(1);
  console.log(`[기존 방식] getDocs 복합 쿼리 조회 + 쓰기: ${legacyTime}ms`);

  // B. 개선 방식 (클라이언트 메모리 ID 매핑으로 getDocs 쿼리 100% 생략, 1회 직접 쓰기)
  const optimizedStart = performance.now();
  // savedDocId가 이미 메모리에 있으므로 쿼리 없이 즉시 쓰기
  await setDoc(doc(db, 'schools', school, 'records', savedDocId), { value: testValue + 0.1, updatedAt: Date.now() }, { merge: true });
  const optimizedTime = (performance.now() - optimizedStart).toFixed(1);
  console.log(`[개선 방식] ID 직접 매핑 1회 직접 쓰기: ${optimizedTime}ms (속도 약 ${(parseFloat(legacyTime) / parseFloat(optimizedTime)).toFixed(1)}배 향상)`);

  console.log("\n=== 벤치마크 완료 ===");
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
