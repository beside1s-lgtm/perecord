import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

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

async function checkItems() {
  await signInAnonymously(auth);
  const snap = await getDocs(collection(db, 'schools', '송정초', 'items'));
  console.log(`총 ${snap.size}개 종목:`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`- ${data.name}: isMeasurementWeek=${data.isMeasurementWeek}, isArchived=${data.isArchived}`);
  });
  process.exit(0);
}
checkItems();
