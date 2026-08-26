'use client';
import type { Student, MeasurementItem, MeasurementRecord, RecordType, StudentToAdd, School, StudentToUpdate, TeamGroup, TeamGroupInput, Tournament, Team, SportsClub, Quiz, QuizAssignment, QuizResult, ItemStatistics, MeasurementPeriod } from './types';
import { v4 as uuidv4 } from 'uuid';
import { initialItems, initialStudents, initialRecords } from './initial-data';
import { db, signIn } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
  runTransaction,
  limit,
  updateDoc,
  serverTimestamp,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';
import { exportToExcel as exportToExcelUtil } from './utils';
import { getPapsGrade } from './paps';

// 초기 데이터 설정 최적화: 트랜잭션 내에서 한 번에 처리
export const initializeData = async (schoolName: string, password?: string) => {
  await signIn();
  const schoolDocRef = doc(db, 'schools', schoolName);
  
  try {
    await runTransaction(db, async (transaction) => {
      const schoolDoc = await transaction.get(schoolDocRef);
      if (schoolDoc.exists()) return;
      
      const schoolData: School = {
        id: schoolName,
        name: schoolName,
        createdAt: serverTimestamp(),
        isStudentInputDisabled: false,
      };
      if (password) schoolData.password = password;
      transaction.set(schoolDocRef, schoolData);

      initialStudents.forEach(student => {
        const studentDocRef = doc(db, 'schools', schoolName, 'students', student.id);
        transaction.set(studentDocRef, {...student, school: schoolName});
      });
      
      initialItems.forEach(item => {
          const itemDocRef = doc(db, 'schools', schoolName, 'items', item.id);
          transaction.set(itemDocRef, item);
      });

      initialRecords.forEach(record => {
          const recordDocRef = doc(collection(db, 'schools', schoolName, 'records')); 
          transaction.set(recordDocRef, { ...record, id: recordDocRef.id, school: schoolName });
      });
    });
  } catch (e: any) {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: schoolDocRef.path,
        operation: 'write',
        requestResourceData: { name: schoolName }
      }));
    }
    throw e;
  }
};

export const exportToExcel = (filename: string, rows: object[]) => {
  exportToExcelUtil(filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`, rows);
}

export const getSchools = async (): Promise<School[]> => {
    await signIn();
    const schoolsRef = collection(db, 'schools');
    const snapshot = await getDocs(schoolsRef);
    return snapshot.docs.map(doc => doc.data() as School);
};

export const deleteSchoolAndData = async (schoolName: string): Promise<void> => {
    await signIn();
    const batch = writeBatch(db);
    const collections = ['students', 'items', 'records', 'teamGroups', 'tournaments', 'statistics', 'quizzes', 'quizAssignments', 'quizResults', 'sportsClubs'];

    for (const coll of collections) {
        const collRef = collection(db, 'schools', schoolName, coll);
        const snapshot = await getDocs(collRef);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }

    batch.delete(doc(db, 'schools', schoolName));
    await batch.commit();
};

export const getSchoolByName = async (schoolName: string): Promise<School | null> => {
  await signIn();
  const schoolRef = doc(db, 'schools', schoolName);
  const schoolSnap = await getDoc(schoolRef);
  return schoolSnap.exists() ? schoolSnap.data() as School : null;
}

export const updateSchoolSetting = async (schoolName: string, settings: Partial<School>): Promise<void> => {
  await signIn();
  await updateDoc(doc(db, 'schools', schoolName), settings);
};

export const updateSchoolPassword = async (schoolName: string, password: string): Promise<void> => {
  await signIn();
  await updateDoc(doc(db, 'schools', schoolName), { password });
}

// --- Student Functions ---
export const getStudents = async (school: string): Promise<Student[]> => {
    await signIn();
    const snapshot = await getDocs(collection(db, 'schools', school, 'students'));
    return snapshot.docs.map(doc => doc.data() as Student);
};

export const deleteStudentAndAssociatedRecords = async (school: string, studentId: string) => {
  await signIn();
  const batch = writeBatch(db);
  const recordsSnapshot = await getDocs(query(collection(db, 'schools', school, 'records'), where('studentId', '==', studentId)));
  
  const affectedItems = new Set<string>();
  recordsSnapshot.forEach(doc => {
    affectedItems.add(doc.data().item);
    batch.delete(doc.ref);
  });

  batch.delete(doc(db, 'schools', school, 'students', studentId));
  await batch.commit();

  // for (const item of affectedItems) {
  //   await updateItemStatistics(school, item);
  // }
};

export const getStudent = async (
  loginInfo: Omit<Student, 'id' | 'gender' | 'photoUrl'> & { accessCode: string }
): Promise<Student | undefined> => {
  await signIn();
  const q = query(
    collection(db, 'schools', loginInfo.school, 'students'),
    where('grade', '==', loginInfo.grade),
    where('classNum', '==', loginInfo.classNum),
    where('studentNum', '==', loginInfo.studentNum),
    where('name', '==', loginInfo.name),
    where('accessCode', '==', loginInfo.accessCode)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? undefined : snapshot.docs[0].data() as Student;
};

export const updateSchoolPeriods = async (schoolId: string, periods: MeasurementPeriod[]) => {
  await signIn();
  const schoolRef = doc(db, 'schools', schoolId);
  await updateDoc(schoolRef, { measurementPeriods: periods });
};

export const addStudent = async (school: string, studentData: StudentToAdd, allStudents: Student[]) => {
    await signIn();
    const existingCodes = new Set(allStudents.map(s => s.accessCode).filter(Boolean));
    let newCode: string;
    do {
      newCode = Math.floor(10000 + Math.random() * 90000).toString();
    } while (existingCodes.has(newCode));

    const studentWithId = { ...studentData, school, id: uuidv4(), accessCode: newCode };
    await setDoc(doc(db, 'schools', school, 'students', studentWithId.id), studentWithId);
    return studentWithId;
};

export const updateStudent = async (school: string, studentId: string, studentData: StudentToUpdate) => {
  await signIn();
  await updateDoc(doc(db, 'schools', school, 'students', studentId), studentData);
};

export const getStudentById = async (school: string, studentId: string): Promise<Student | undefined> => {
    await signIn();
    const docSnap = await getDoc(doc(db, 'schools', school, 'students', studentId));
    return docSnap.exists() ? docSnap.data() as Student : undefined;
}

export const assignMissingAccessCodes = async (school: string): Promise<void> => {
  await signIn();
  const students = await getStudents(school);
  const studentsWithoutCode = students.filter(s => !s.accessCode);
  if (studentsWithoutCode.length === 0) return;
  
  const existingCodes = new Set(students.map(s => s.accessCode).filter(Boolean));
  const batch = writeBatch(db);

  studentsWithoutCode.forEach(student => {
    let newCode: string;
    do { newCode = Math.floor(10000 + Math.random() * 90000).toString(); } while (existingCodes.has(newCode));
    existingCodes.add(newCode);
    batch.update(doc(db, 'schools', school, 'students', student.id), { accessCode: newCode });
  });
  await batch.commit();
};

export const promoteStudents = async (school: string, allStudents: Student[], promotionData: any[]): Promise<number> => {
  await signIn();
  const batch = writeBatch(db);
  const studentMapByName = new Map(allStudents.map(s => [`${s.school}-${s.grade}-${s.classNum}-${s.studentNum}-${s.name}`, s]));
  let updatedCount = 0;

  for (const promo of promotionData) {
    const studentKey = `${promo.school}-${promo.grade}-${promo.classNum}-${promo.studentNum}-${promo.name}`;
    const student = studentMapByName.get(studentKey);
    if (student && promo.newGrade && promo.newClassNum && promo.newStudentNum) {
      // 1. 기존의 schoolHistory 이력이 없으면 초기화
      const history = student.schoolHistory || [];
      
      // 2. 현재 진급 직전 학년의 이력을 기록 (중복 방지)
      const hasCurrentHistory = history.some(h => h.grade === student.grade);
      if (!hasCurrentHistory) {
        history.push({
          schoolName: student.officialSchoolName || student.school,
          grade: student.grade,
          classNum: student.classNum,
          studentNum: student.studentNum,
          teacherName: student.teacherName || '-',
        });
      }

      batch.update(doc(db, 'schools', school, 'students', student.id), {
        grade: promo.newGrade,
        classNum: promo.newClassNum,
        studentNum: promo.newStudentNum,
        officialSchoolName: promo.newOfficialSchoolName || student.officialSchoolName || school,
        teacherName: promo.newTeacherName || '-',
        schoolHistory: history,
      });
      updatedCount++;
    }
  }
  if (updatedCount > 0) await batch.commit();
  return updatedCount;
};

// --- Measurement Items ---
export const getItems = async (school: string): Promise<MeasurementItem[]> => {
    await signIn();
    const snapshot = await getDocs(collection(db, 'schools', school, 'items'));
    return snapshot.docs.map(doc => doc.data() as MeasurementItem);
};

export const addItem = async (school: string, item: Omit<MeasurementItem, 'id' | 'category'> & {category?: string}) => {
  await signIn();
  const itemsRef = collection(db, 'schools', school, 'items');
  const existing = await getDocs(query(itemsRef, where("name", "==", item.name), limit(1)));

  if (existing.empty) {
    const newItemRef = doc(itemsRef);
    const newItem = { ...item, id: newItemRef.id, isDeactivated: false, isArchived: false };
    await setDoc(newItemRef, newItem);
    return newItem;
  }
  
  const existingItem = existing.docs[0].data() as MeasurementItem;
  if (existingItem.isDeactivated) {
      await updateDoc(existing.docs[0].ref, { isDeactivated: false, isArchived: false });
      return { ...existingItem, isDeactivated: false, isArchived: false };
  }
  return existingItem;
};

export const updateItem = async (school: string, itemId: string, data: Partial<Omit<MeasurementItem, 'id'>>) => {
    await signIn();
    const cleanData: any = {};
    Object.entries(data).forEach(([key, value]) => { if (value !== undefined) cleanData[key] = value; });
    await updateDoc(doc(db, 'schools', school, 'items', itemId), cleanData);
};

export const archiveItem = async (school: string, itemId: string, archive: boolean): Promise<void> => {
  await signIn();
  await updateDoc(doc(db, 'schools', school, 'items', itemId), { isArchived: archive, isDeactivated: false });
};

export const archiveCategory = async (school: string, category: string, items: MeasurementItem[], archive: boolean): Promise<void> => {
  await signIn();
  const batch = writeBatch(db);
  items.filter(item => (item.category || (item.isPaps ? 'PAPS' : '기타')) === category).forEach(item => {
    batch.update(doc(db, 'schools', school, 'items', item.id), { isArchived: archive, isDeactivated: false });
  });
  await batch.commit();
};

export const deactivateItem = async (school: string, itemId: string, deactivate: boolean): Promise<void> => {
    await signIn();
    const updates: any = { isDeactivated: deactivate, isArchived: false };
    if (deactivate) updates.isMeasurementWeek = false;
    await updateDoc(doc(db, 'schools', school, 'items', itemId), updates);
};

export const deactivateCategory = async (school: string, category: string, items: MeasurementItem[], deactivate: boolean): Promise<void> => {
    await signIn();
    const batch = writeBatch(db);
    const updates: any = { isDeactivated: deactivate, isArchived: false };
    if (deactivate) updates.isMeasurementWeek = false;
    items.filter(item => (item.category || (item.isPaps ? 'PAPS' : '기타')) === category && !item.isPaps).forEach(item => {
      batch.update(doc(db, 'schools', school, 'items', item.id), updates);
    });
    await batch.commit();
};

// --- Records ---
export const getRecords = async (school: string): Promise<MeasurementRecord[]> => {
    await signIn();
    const snapshot = await getDocs(collection(db, 'schools', school, 'records'));
    return snapshot.docs.map(doc => doc.data() as MeasurementRecord);
}

export const addOrUpdateRecord = async (record: Partial<MeasurementRecord> & Pick<MeasurementRecord, 'school' | 'studentId' | 'item' | 'value' | 'date'>): Promise<MeasurementRecord> => {
  await signIn();
  const recordsRef = collection(db, 'schools', record.school, 'records');
  const q = query(recordsRef, where('studentId', '==', record.studentId), where('item', '==', record.item), where('date', '==', record.date), limit(1));
  
  try {
    const querySnapshot = await getDocs(q);

    let finalRecord: MeasurementRecord;
    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      const updates: any = { value: record.value };
      if (record.height !== undefined) updates.height = record.height;
      if (record.weight !== undefined) updates.weight = record.weight;
      await updateDoc(docRef, updates);
      finalRecord = { ...querySnapshot.docs[0].data(), id: docRef.id, value: record.value, height: record.height, weight: record.weight } as MeasurementRecord;
    } else {
      const newRef = record.id ? doc(recordsRef, record.id) : doc(recordsRef);
      // Firestore는 undefined 값을 허용하지 않으므로 undefined 필드를 제거합니다
      const rawRecord = { ...record, id: newRef.id };
      const finalObj: Record<string, any> = {};
      Object.entries(rawRecord).forEach(([k, v]) => { if (v !== undefined) finalObj[k] = v; });
      finalRecord = finalObj as MeasurementRecord;
      await setDoc(newRef, finalObj);
    }
    
    return finalRecord;
  } catch (e: any) {
    console.error('[addOrUpdateRecord] Firestore 저장 실패:', {
      code: e?.code,
      message: e?.message,
      school: record.school,
      item: record.item,
      date: record.date,
    });
    throw e;
  }
};

export const deleteRecord = async (school: string, recordId: string) => {
  await signIn();
  const snap = await getDoc(doc(db, 'schools', school, 'records', recordId));
  const itemName = snap.exists() ? snap.data().item : null;
  await deleteDoc(doc(db, 'schools', school, 'records', recordId));
  // if (itemName) updateItemStatistics(school, itemName);
};

export const deleteRecordsByDateAndItem = async (school: string, date: string, item: string): Promise<number> => {
    await signIn();
    const snapshot = await getDocs(query(collection(db, 'schools', school, 'records'), where('date', '==', date), where('item', '==', item)));
    if (snapshot.empty) return 0;
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    // updateItemStatistics(school, item);
    return snapshot.size;
};

export const addOrUpdateRecords = async (school: string, students: Student[], recordsToProcess: any[]): Promise<MeasurementRecord[]> => {
  await signIn();
  const updatedRecords: MeasurementRecord[] = [];

  if (recordsToProcess.length > 0) {
    const batch = writeBatch(db);
    
    // Firestore 쿼리를 병렬로 조회하여 네트워크 왕복 시간 최소화
    const queries = recordsToProcess.map(record => {
      const q = query(
        collection(db, 'schools', school, 'records'), 
        where('studentId', '==', record.studentId), 
        where('item', '==', record.item), 
        where('date', '==', record.date), 
        limit(1)
      );
      return getDocs(q).then(snapshot => ({ record, snapshot }));
    });

    const results = await Promise.all(queries);

    for (const { record, snapshot } of results) {
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        const updates: any = { value: record.value };
        if (record.height !== undefined) updates.height = record.height;
        if (record.weight !== undefined) updates.weight = record.weight;
        batch.update(docRef, updates);
        updatedRecords.push({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id, value: record.value, height: record.height, weight: record.weight } as MeasurementRecord);
      } else {
        const docRef = doc(collection(db, 'schools', school, 'records'));
        const rawDoc = { ...record, id: docRef.id };
        const cleanDoc: Record<string, any> = {};
        Object.entries(rawDoc).forEach(([k, v]) => { if (v !== undefined) cleanDoc[k] = v; });
        batch.set(docRef, cleanDoc);
        updatedRecords.push(cleanDoc as MeasurementRecord);
      }
    }

    await batch.commit();
  }
  return updatedRecords;
};

export const getRecordsByStudent = async (school: string, studentId: string): Promise<MeasurementRecord[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'records'), where("studentId", "==", studentId)));
  return snapshot.docs.map(doc => doc.data() as MeasurementRecord);
};

// --- Statistics & Ranks (Pre-calculated Cache) ---
export const updateItemStatistics = async (school: string, itemName: string, students: Student[], items: MeasurementItem[], records?: MeasurementRecord[]): Promise<void> => {
    await signIn();
    
    let allRecords: MeasurementRecord[];
    if (records) {
        allRecords = records.filter(r => r.item === itemName);
    } else {
        const snapshot = await getDocs(query(collection(db, 'schools', school, 'records'), where('item', '==', itemName)));
        allRecords = snapshot.docs.map(d => d.data() as MeasurementRecord);
    }
    const itemInfo = items.find(i => i.name === itemName);
    if (!itemInfo) return;

    const grades = [...new Set(students.map(s => s.grade))];
    const gradeStats: ItemStatistics['gradeStats'] = {};
    const studentMap = new Map(students.map(s => [s.id, s]));

    for (const grade of grades) {
        const gradeStudentIds = new Set(students.filter(s => s.grade === grade).map(s => s.id));
        const latestRecords: Record<string, MeasurementRecord> = {};
        allRecords.filter(r => gradeStudentIds.has(r.studentId)).forEach(record => {
            if (!latestRecords[record.studentId] || new Date(record.date) > new Date(latestRecords[record.studentId].date)) {
                latestRecords[record.studentId] = record;
            }
        });

        const studentValues = Object.values(latestRecords);
        if (studentValues.length === 0) continue;

        if (itemInfo.recordType === 'time' || itemInfo.recordType === 'level') {
            studentValues.sort((a, b) => a.value - b.value);
        } else {
            studentValues.sort((a, b) => b.value - a.value);
        }

        const allRanks: { studentId: string; rank: number; value: number }[] = [];
        let rank = 1;
        for (let i = 0; i < studentValues.length; i++) {
            if (i > 0 && studentValues[i].value !== studentValues[i - 1].value) rank = i + 1;
            allRanks.push({ studentId: studentValues[i].studentId, value: studentValues[i].value, rank });
        }

        const totalValue = studentValues.reduce((acc, r) => acc + r.value, 0);
        
        // 등급 분포 계산 (PAPS 종목인 경우)
        const gradeDistribution: Record<string, number> = { '1등급': 0, '2등급': 0, '3등급': 0, '4등급': 0, '5등급': 0 };
        if (itemInfo.isPaps) {
            studentValues.forEach(r => {
                const s = studentMap.get(r.studentId);
                const g = s ? getPapsGrade(itemInfo.name, s, r.value) : null;
                if (g) gradeDistribution[`${g}등급`]++;
            });
            // 퍼센테이지로 변환
            Object.keys(gradeDistribution).forEach(key => {
                gradeDistribution[key] = parseFloat(((gradeDistribution[key] / studentValues.length) * 100).toFixed(2));
            });
        }

        const topRanks = allRanks.slice(0, 5).map(r => {
            const s = studentMap.get(r.studentId);
            return { ...r, name: s?.name || '?', classNum: s?.classNum || '?' };
        });

        const statsEntry: any = { 
            average: parseFloat((totalValue / studentValues.length).toFixed(2)), 
            count: studentValues.length, 
            topRanks, 
            allRanks
        };
        if (itemInfo.isPaps) {
            statsEntry.gradeDistribution = gradeDistribution;
        }
        gradeStats[grade] = statsEntry;
    }

    // Firestore는 undefined 값을 허용하지 않으므로 JSON 직렬화로 정리 후 저장
    const cleanGradeStats = JSON.parse(JSON.stringify(gradeStats));
    await setDoc(doc(db, 'schools', school, 'statistics', itemName), { id: itemName, gradeStats: cleanGradeStats, lastUpdated: serverTimestamp() });
};

export const rebuildAllStatistics = async (school: string): Promise<void> => {
    await signIn();
    try {
        const [items, students, allRecords] = await Promise.all([
            getItems(school),
            getStudents(school),
            getRecords(school),
        ]);
        const activeItems = items.filter(i => !i.isDeactivated && !i.isArchived);
        
        for (const item of activeItems) {
            try {
                await updateItemStatistics(school, item.name, students, items, allRecords);
            } catch (err) {
                console.error(`Error updating statistics for item "${item.name}":`, err);
                throw err;
            }
        }
    } catch (e) {
        console.error("Error in rebuildAllStatistics:", e);
        throw e;
    }
};

export const getStatistics = async (school: string): Promise<ItemStatistics[]> => {
    await signIn();
    const snapshot = await getDocs(collection(db, 'schools', school, 'statistics'));
    return snapshot.docs.map(doc => doc.data() as ItemStatistics);
};

export const calculateRanks = (school: string, allItems: MeasurementItem[], allRecords: MeasurementRecord[], allStudents: Student[], grade?: string): Record<string, { studentId: string; value: number; rank: number }[]> => {
  const allRanks: Record<string, { studentId: string; value: number; rank: number }[]> = {};
  const gradeStudentIds = new Set((grade ? allStudents.filter(s => s.grade === grade) : allStudents).map(s => s.id));

  allItems.forEach(item => {
    const latestRecords: Record<string, MeasurementRecord> = {};
    allRecords.filter(r => r.item === item.name && gradeStudentIds.has(r.studentId)).forEach(record => {
      if (!latestRecords[record.studentId] || new Date(record.date) > new Date(latestRecords[record.studentId].date)) {
        latestRecords[record.studentId] = record;
      }
    });

    const studentValues = Object.values(latestRecords);
    if (item.name === '체질량지수(BMI)') {
      studentValues.sort((a, b) => {
        const sA = allStudents.find(s => s.id === a.studentId);
        const sB = allStudents.find(s => s.id === b.studentId);
        const gA = sA ? (getPapsGrade(item.name, sA, a.value) || 5) : 5;
        const gB = sB ? (getPapsGrade(item.name, sB, b.value) || 5) : 5;
        if (gA !== gB) return gA - gB;
        return a.value - b.value;
      });
    } else if (item.recordType === 'time' || item.recordType === 'level') { 
      studentValues.sort((a, b) => a.value - b.value); 
    } else { 
      studentValues.sort((a, b) => b.value - a.value); 
    }

    const ranks: { studentId: string; value: number; rank: number }[] = [];
    let rank = 1;
    for (let i = 0; i < studentValues.length; i++) {
      if (item.name === '체질량지수(BMI)') {
        const sA = allStudents.find(s => s.id === studentValues[i].studentId);
        const sPrev = i > 0 ? allStudents.find(s => s.id === studentValues[i-1].studentId) : null;
        const gA = sA ? (getPapsGrade(item.name, sA, studentValues[i].value) || 5) : 5;
        const gPrev = sPrev ? (getPapsGrade(item.name, sPrev, studentValues[i-1].value) || 5) : 5;
        
        if (i > 0 && (studentValues[i].value !== studentValues[i - 1].value || gA !== gPrev)) {
          rank = i + 1;
        }
      } else {
        if (i > 0 && studentValues[i].value !== studentValues[i - 1].value) rank = i + 1;
      }
      ranks.push({ studentId: studentValues[i].studentId, value: studentValues[i].value, rank });
    }
    allRanks[item.name] = ranks;
  });
  return allRanks;
};

export const cleanUpDuplicateRecords = async (school: string): Promise<number> => {
  await signIn();
  const snapshot = await getDocs(collection(db, 'schools', school, 'records'));
  const records = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MeasurementRecord));
  const groups = new Map<string, MeasurementRecord[]>();

  records.forEach(r => {
    const key = `${r.studentId}-${r.item}-${r.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const batch = writeBatch(db);
  let duplicates = 0;
  const affected = new Set<string>();

  for (const group of groups.values()) {
    if (group.length > 1) {
      duplicates += group.length - 1;
      affected.add(group[0].item);
      group.sort((a, b) => b.id.localeCompare(a.id));
      for (let i = 1; i < group.length; i++) batch.delete(doc(db, 'schools', school, 'records', group[i].id));
    }
  }

  if (duplicates > 0) {
    await batch.commit();
    // for (const item of affected) updateItemStatistics(school, item);
  }
  return duplicates;
};

// --- Team Groups ---
export const saveTeamGroup = async (teamGroupData: TeamGroupInput): Promise<TeamGroup> => {
    await signIn();
    const newRef = doc(collection(db, 'schools', teamGroupData.school, 'teamGroups'));
    const finalData = { ...teamGroupData, id: newRef.id, createdAt: serverTimestamp(), teams: teamGroupData.teams.map((t, i) => ({ ...t, id: t.id || uuidv4(), teamIndex: t.teamIndex ?? i, memberIds: t.memberIds || [] })) };
    await setDoc(newRef, finalData);
    return (await getDoc(newRef)).data() as TeamGroup;
};

export const updateTeamGroup = async (teamGroupId: string, teamGroupData: TeamGroupInput): Promise<TeamGroup> => {
    await signIn();
    const ref = doc(db, 'schools', teamGroupData.school, 'teamGroups', teamGroupId);
    const data = { ...teamGroupData, teams: teamGroupData.teams.map((t, i) => ({ ...t, id: t.id || uuidv4(), teamIndex: t.teamIndex ?? i, memberIds: t.memberIds || [] })) };
    await updateDoc(ref, data);
    return (await getDoc(ref)).data() as TeamGroup;
};

export const getTeamGroups = async (school: string): Promise<TeamGroup[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'teamGroups'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => doc.data() as TeamGroup);
};

export const deleteTeamGroup = async (school: string, teamGroupId: string): Promise<void> => {
  await signIn();
  await deleteDoc(doc(db, 'schools', school, 'teamGroups', teamGroupId));
};

export const getLatestTeamGroupForStudent = async (school: string, studentId: string): Promise<TeamGroup | null> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'teamGroups'), orderBy('createdAt', 'desc')));
  for (const doc of snapshot.docs) {
    const group = doc.data() as TeamGroup;
    if (group.teams.some(team => team.memberIds?.includes(studentId))) return group;
  }
  return null;
};

// --- Sports Clubs ---
export const saveSportsClub = async (school: string, name: string, memberIds: string[]): Promise<SportsClub> => {
  await signIn();
  const newRef = doc(collection(db, 'schools', school, 'sportsClubs'));
  const club = { id: newRef.id, school, name, memberIds, createdAt: serverTimestamp() };
  await setDoc(newRef, club);
  return club as any;
};

export const getSportsClubs = async (school: string): Promise<SportsClub[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'sportsClubs'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => doc.data() as SportsClub);
};

export const updateSportsClub = async (school: string, clubId: string, data: Partial<Omit<SportsClub, 'id'|'school'|'createdAt'>>): Promise<void> => {
  await signIn();
  await updateDoc(doc(db, 'schools', school, 'sportsClubs', clubId), data);
};

export const deleteSportsClub = async (school: string, clubId: string): Promise<void> => {
  await signIn();
  await deleteDoc(doc(db, 'schools', school, 'sportsClubs', clubId));
};

// --- Tournament Functions ---
export const saveTournament = async (tournament: Omit<Tournament, 'id' | 'createdAt'>): Promise<Tournament> => {
  await signIn();
  const newRef = doc(collection(db, 'schools', tournament.school, 'tournaments'));
  const data = { ...tournament, id: newRef.id, createdAt: serverTimestamp() };
  await setDoc(newRef, data);
  return (await getDoc(newRef)).data() as Tournament;
};

export const getTournaments = async (school: string): Promise<Tournament[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'tournaments'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => doc.data() as Tournament);
};

export const getLatestTournamentForStudent = async (school: string, studentId: string, allStudents: Student[], allTeamGroups: TeamGroup[]): Promise<Tournament | null> => {
  await signIn();
  const student = allStudents.find(s => s.id === studentId);
  if (!student) return null;

  const snapshot = await getDocs(query(collection(db, 'schools', school, 'tournaments'), orderBy('createdAt', 'desc'), limit(10)));
  const allTournaments = snapshot.docs.map(d => d.data() as Tournament);

  const studentTeamGroup = allTeamGroups.find(group => group.teams.some(team => team.memberIds.includes(studentId)));
  if (studentTeamGroup) {
      const groupTournament = allTournaments.find(t => t.teamGroupId === studentTeamGroup.id);
      if (groupTournament) return groupTournament;
  }

  const matching = allTournaments.find(t => t.grade === student.grade && (t.gender === 'all' || t.gender === student.gender));
  return matching || null;
};

export const updateTournament = async (school: string, tournamentId: string, data: Partial<Omit<Tournament, 'id' | 'school'>>): Promise<void> => {
  await signIn();
  await updateDoc(doc(db, 'schools', school, 'tournaments', tournamentId), data);
};

export const deleteTournament = async (school: string, tournamentId: string): Promise<void> => {
  await signIn();
  await deleteDoc(doc(db, 'schools', school, 'tournaments', tournamentId));
};

export const deleteItemAndAssociatedRecords = async (school: string, itemToDelete: MeasurementItem) => {
  await signIn();
  if (itemToDelete.isPaps) return;
  const batch = writeBatch(db);
  const records = await getDocs(query(collection(db, 'schools', school, 'records'), where('item', '==', itemToDelete.name)));
  records.forEach(doc => batch.delete(doc.ref));
  batch.delete(doc(db, 'schools', school, 'items', itemToDelete.id));
  batch.delete(doc(db, 'schools', school, 'statistics', itemToDelete.name));
  await batch.commit();
};

export const deleteCategoryAndAssociatedRecords = async (school: string, category: string, allItems: MeasurementItem[]): Promise<void> => {
  await signIn();
  const batch = writeBatch(db);
  const items = allItems.filter(i => (i.category || (i.isPaps ? 'PAPS' : '기타')) === category && !i.isPaps);
  const names = items.map(i => i.name);
  if (!names.length) return;

  for (let i = 0; i < names.length; i += 30) {
      const chunk = names.slice(i, i + 30);
      const records = await getDocs(query(collection(db, 'schools', school, 'records'), where('item', 'in', chunk)));
      records.forEach(doc => batch.delete(doc.ref));
  }

  items.forEach(i => {
    batch.delete(doc(db, 'schools', school, 'items', i.id));
    batch.delete(doc(db, 'schools', school, 'statistics', i.name));
  });
  await batch.commit();
};

// --- Quiz Functions ---
export const saveQuiz = async (school: string, quizData: Omit<Quiz, 'id' | 'createdAt'>): Promise<Quiz> => {
  await signIn();
  const newRef = doc(collection(db, 'schools', school, 'quizzes'));
  const data = { ...quizData, id: newRef.id, createdAt: serverTimestamp() };
  await setDoc(newRef, data);
  return data as any;
};

export const getQuizzes = async (school: string): Promise<Quiz[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'quizzes'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => doc.data() as Quiz);
};

export const deleteQuiz = async (school: string, quizId: string): Promise<void> => {
  await signIn();
  await deleteDoc(doc(db, 'schools', school, 'quizzes', quizId));
};

export const distributeQuiz = async (school: string, assignment: Omit<QuizAssignment, 'id' | 'createdAt' | 'status'>): Promise<void> => {
  await signIn();
  const newRef = doc(collection(db, 'schools', school, 'quizAssignments'));
  await setDoc(newRef, { ...assignment, id: newRef.id, createdAt: serverTimestamp(), status: 'active' });
};

export const getQuizAssignments = async (school: string): Promise<QuizAssignment[]> => {
  await signIn();
  const snapshot = await getDocs(query(collection(db, 'schools', school, 'quizAssignments'), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(doc => doc.data() as QuizAssignment);
};

export const deleteQuizAssignment = async (school: string, assignmentId: string): Promise<void> => {
  await signIn();
  await deleteDoc(doc(collection(db, 'schools', school, 'quizAssignments'), assignmentId));
};

export const saveQuizResult = async (school: string, result: Omit<QuizResult, 'id' | 'createdAt'>): Promise<void> => {
  await signIn();
  const resultsRef = collection(db, 'schools', school, 'quizResults');
  const snapshot = await getDocs(query(resultsRef, where('assignmentId', '==', result.assignmentId), where('studentId', '==', result.studentId)));
  if (!snapshot.empty) await updateDoc(snapshot.docs[0].ref, { ...result, createdAt: serverTimestamp() });
  else await setDoc(doc(resultsRef), { ...result, id: uuidv4(), createdAt: serverTimestamp() });
};

export const getQuizResultsBySchool = async (school: string): Promise<QuizResult[]> => {
  await signIn();
  const snapshot = await getDocs(collection(db, 'schools', school, 'quizResults'));
  return snapshot.docs.map(doc => doc.data() as QuizResult);
};

// --- 건강기록부 검진기관 설정 함수 ---
export const saveSchoolExamInstitutions = async (
  schoolName: string,
  institutions: { general: string[]; dental: string[] }
): Promise<void> => {
  await signIn();
  const schoolDocRef = doc(db, 'schools', schoolName);
  await updateDoc(schoolDocRef, {
    healthExamInstitutions: institutions.general,
    dentalExamInstitutions: institutions.dental,
  });
};

export const getSchoolExamInstitutions = async (
  schoolName: string
): Promise<{ general: string[]; dental: string[] }> => {
  await signIn();
  const schoolDocRef = doc(db, 'schools', schoolName);
  const schoolDoc = await getDoc(schoolDocRef);
  if (schoolDoc.exists()) {
    const data = schoolDoc.data() as School;
    return {
      general: data.healthExamInstitutions || [],
      dental: data.dentalExamInstitutions || [],
    };
  }
  return { general: [], dental: [] };
};
