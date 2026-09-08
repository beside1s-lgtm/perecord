
"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getStudents, getItems, getRecords, getTeamGroups, getSportsClubs, getStatistics } from "@/lib/store";
import { signIn } from "@/lib/firebase";
import type { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub, ItemStatistics } from "@/lib/types";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentManagement } from "./_components/StudentManagement";
import { DatabaseManagement } from "./_components/DatabaseManagement";
import { HealthRecordManagement } from "./_components/HealthRecordManagement";
import MeasurementManagement from "./_components/MeasurementManagement";
import ClassAnalytics from "./_components/ClassAnalytics";
import RecordBrowser from "./_components/RecordBrowser";
import Ranking from "./_components/Ranking";
import RecordInput from "./_components/RecordInput";
import TournamentManagement from "./_components/TournamentManagement";
import TeamBalancer from "./_components/TeamBalancer";
import SportsClubManagement from "./_components/SportsClubManagement";
import TheoryExamManagement from "./_components/TheoryExamManagement";
import {
  LineChart,
  BookOpen,
  Swords,
  Database,
  Bot,
  Loader2,
} from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

const tabVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

function DashboardSkeleton() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-40 col-span-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="h-[500px] w-full rounded-2xl" />
    </div>
  );
}

export default function TeacherDashboardPage() {
  const { school, isLoading: isAuthLoading } = useAuth();
  const [data, setData] = useState<{
    students: Student[];
    items: MeasurementItem[];
    records: MeasurementRecord[];
    teams: TeamGroup[];
    clubs: SportsClub[];
    statistics: ItemStatistics[];
  }>({ students: [], items: [], records: [], teams: [], clubs: [], statistics: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("measurement");
  const [activeFeature, setActiveFeature] = useState<string>("input");
  const router = useRouter();

  // URL 쿼리 파라미터가 있을 경우 초기 동기화
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      const subtab = params.get('subtab');
      if (tab && ['measurement', 'theory', 'competition', 'data'].includes(tab)) {
        setActiveCategory(tab);
        if (subtab) setActiveFeature(subtab);
      }
    }
  }, []);

  // 브라우저 영구 캐시 키 (브라우저를 닫았다가 다시 열어도 0초 즉시 로딩)
  const getCacheKey = useCallback(() => `pe_dash_local_cache_${school}`, [school]);

  const load = useCallback(async (force = false) => {
    if (!school) return;
    
    // 1. 브라우저 영구 캐시 확인 (Stale-While-Revalidate: 캐시로 즉각 0.05초 렌더링 후 백그라운드 갱신)
    if (!force) {
      try {
        const cachedRaw = localStorage.getItem(getCacheKey());
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && Array.isArray(parsed.students)) {
            setData(parsed);
            setIsLoading(false);
            // 캐시 데이터로 즉각 화면을 띄운 뒤, 백그라운드에서 조용히 최신 데이터 갱신
            Promise.all([
              getStudents(school),
              getItems(school),
              getRecords(school),
              getTeamGroups(school),
              getSportsClubs(school),
              getStatistics(school)
            ]).then(([students, items, records, teams, clubs, statistics]) => {
              const fullData = { students, items, records, teams, clubs, statistics };
              setData(fullData);
              try {
                // 용량 초과 방지를 위해 캐시용 경량 학생 데이터 구성
                const lightStudents = students.map(s => ({
                  id: s.id, name: s.name, grade: s.grade, classNum: s.classNum,
                  studentNum: s.studentNum, gender: s.gender, personalCode: s.personalCode,
                  school: s.school, photoUrl: s.photoUrl,
                }));
                localStorage.setItem(getCacheKey(), JSON.stringify({
                  ...fullData,
                  records: [], // records는 IndexedDB(Firestore persistentLocalCache)에 영구 보존되므로 localStorage 용량 절약
                  students: lightStudents
                }));
              } catch (e) {
                // localStorage 용량 제한 도달 시 안전 무시
              }
            }).catch(() => {});
            return;
          }
        }
      } catch (e) {
        localStorage.removeItem(getCacheKey());
      }
    }

    // 2. 캐시가 없는 최초 1회 방문 시: 필터 및 필수 기초 데이터 로딩
    if (!force) setIsLoading(true);
    try {
      await signIn();
      const [students, items, teams, clubs] = await Promise.all([
        getStudents(school), 
        getItems(school), 
        getTeamGroups(school), 
        getSportsClubs(school)
      ]);
      
      const initialData = { 
        students, 
        items, 
        records: [], 
        teams, 
        clubs, 
        statistics: [] 
      };
      
      setData(initialData);
      
      // 기초 데이터 로드 완료 즉시 스켈레톤 해제하여 대시보드 표시 (지연 시간 최소화)
      if (!force) setIsLoading(false);

      // 무거운 기록 데이터와 통계 데이터는 백그라운드에서 병렬 로드
      Promise.all([
        getRecords(school),
        getStatistics(school)
      ]).then(([records, statistics]) => {
        setData(prev => {
          const updated = { ...prev, records, statistics };
          
          try {
            const lightStudents = updated.students.map(s => ({
              id: s.id, name: s.name, grade: s.grade, classNum: s.classNum,
              studentNum: s.studentNum, gender: s.gender, personalCode: s.personalCode,
              school: s.school, photoUrl: s.photoUrl,
            }));
            const cacheData = { ...updated, records: [], students: lightStudents };
            localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
          } catch (e) {
            // 저장 실패 시 무시
          }

          return updated;
        });
      }).catch(e => {
        console.error("Background data load failed", e);
      });

    } catch (e) {
      console.error("Teacher dashboard load failed", e);
      if (!force) setIsLoading(false);
    }
  }, [school, getCacheKey]);

  // 최초 로드 시 1회만 실행 (캐시 우선 발동)
  useEffect(() => { 
    if (school) {
        load(false); 
    }
  }, [school, load]);

  useEffect(() => {
     if (activeCategory) {
       const url = new URL(window.location.href);
       url.searchParams.set('tab', activeCategory);
       if (activeFeature) {
         url.searchParams.set('subtab', activeFeature);
       }
       router.replace(url.pathname + url.search, { scroll: false });
     }
  }, [activeCategory, activeFeature, router]);

  // 로컬 상태 즉시 갱신 핸들러 (불필요한 전체 네트워크 리로드 방지)
  const handleRecordUpdate = useCallback((recordsOrId?: MeasurementRecord[] | string, action: 'update' | 'delete' = 'update') => {
    setData(prev => {
      let updatedRecords = [...prev.records];
      if (action === 'delete') {
        const idToDelete = typeof recordsOrId === 'string' ? recordsOrId : '';
        updatedRecords = updatedRecords.filter(r => r.id !== idToDelete);
      } else if (Array.isArray(recordsOrId)) {
        const newRecordsMap = new Map(recordsOrId.map(r => [r.id, r]));
        const existingIds = new Set<string>();
        updatedRecords = updatedRecords.map(r => {
          if (newRecordsMap.has(r.id)) {
            existingIds.add(r.id);
            return newRecordsMap.get(r.id)!;
          }
          return r;
        });
        recordsOrId.forEach(r => {
          if (!existingIds.has(r.id)) {
            updatedRecords.push(r);
          }
        });
      }
      return { ...prev, records: updatedRecords };
    });
  }, []);

  const handleTeamGroupUpdate = useCallback((updatedGroup: TeamGroup) => {
    setData(prev => {
      const exists = prev.teams.some(t => t.id === updatedGroup.id);
      const newTeams = exists
        ? prev.teams.map(t => t.id === updatedGroup.id ? updatedGroup : t)
        : [...prev.teams, updatedGroup];
      return { ...prev, teams: newTeams };
    });
  }, []);

  const handleTeamGroupDelete = useCallback((groupId: string) => {
    setData(prev => ({
      ...prev,
      teams: prev.teams.filter(t => t.id !== groupId)
    }));
  }, []);

  const handleClubUpdate = useCallback(() => {
    if (!school) return;
    getSportsClubs(school).then(clubs => {
      setData(prev => ({ ...prev, clubs }));
    });
  }, [school]);

  const handleTournamentUpdate = useCallback(() => {
    if (!school) return;
    getTeamGroups(school).then(teams => {
      setData(prev => ({ ...prev, teams }));
    });
  }, [school]);

  const renderTabContent = useMemo(() => {
    if (isLoading || isAuthLoading) return <DashboardSkeleton />;

    return (
      <AnimatePresence mode="wait">
        <motion.div
           key={`${activeCategory}-${activeFeature}`}
           variants={tabVariants}
           initial="initial"
           animate="animate"
           exit="exit"
           className="w-full"
        >
          <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>}>
            {/* 1. 측정 & 분석 카테고리 */}
            {activeCategory === "measurement" && (
              <>
                {activeFeature === "input" && (
                  <RecordInput allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={handleRecordUpdate} allTeamGroups={data.teams} sportsClubs={data.clubs} />
                )}
                {activeFeature === "analysis" && (
                  <ClassAnalytics allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={handleRecordUpdate} sportsClubs={data.clubs} />
                )}
                {activeFeature === "browser" && (
                  <RecordBrowser allStudents={data.students} allItems={data.items} allRecords={data.records} sportsClubs={data.clubs} />
                )}
                {activeFeature === "ranking" && (
                  <Ranking allStudents={data.students} allItems={data.items} allRecords={data.records} sportsClubs={data.clubs} />
                )}
              </>
            )}

            {/* 2. 이론 평가 카테고리 */}
            {activeCategory === "theory" && (
              <TheoryExamManagement allStudents={data.students} sportsClubs={data.clubs} />
            )}

            {/* 3. 대회 & 팀 카테고리 */}
            {activeCategory === "competition" && (
              <>
                {activeFeature === "tournament" && (
                  <TournamentManagement onTournamentUpdate={handleTournamentUpdate} allTeamGroups={data.teams} allStudents={data.students} />
                )}
                {activeFeature === "balancer" && (
                  <TeamBalancer allStudents={data.students} allItems={data.items} allRecords={data.records} teamGroups={data.teams} onTeamGroupUpdate={handleTeamGroupUpdate} onTeamGroupDelete={handleTeamGroupDelete} sportsClubs={data.clubs} />
                )}
                {activeFeature === "clubs" && (
                  <SportsClubManagement allStudents={data.students} sportsClubs={data.clubs} onClubUpdate={handleClubUpdate} />
                )}
              </>
            )}

            {/* 4. 데이터 관리 카테고리 */}
            {activeCategory === "data" && (
              <>
                {activeFeature === "students" && (
                  <StudentManagement students={data.students} onStudentsUpdate={() => load(true)} />
                )}
                {activeFeature === "items" && (
                  <MeasurementManagement items={data.items} onItemsUpdate={(newItems) => setData(prev => ({...prev, items: newItems}))} />
                )}
                {activeFeature === "db" && (
                  <DatabaseManagement students={data.students} records={data.records} items={data.items} onUpdate={() => load(true)} />
                )}
                {activeFeature === "health-record" && (
                  <HealthRecordManagement students={data.students} items={data.items} records={data.records} onUpdate={() => load(true)} />
                )}
              </>
            )}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    );
  }, [isLoading, isAuthLoading, data, load, activeCategory, activeFeature, handleRecordUpdate, handleTournamentUpdate, handleTeamGroupUpdate, handleTeamGroupDelete, handleClubUpdate]);

  if (isAuthLoading) return <DashboardSkeleton />;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 md:px-10 py-1 sm:py-4 space-y-2 sm:space-y-4 pb-32 overflow-x-hidden">
      <div className="no-print">
        <DashboardHeader 
          onStatsRebuilt={() => load(true)}
          allStudents={data.students}
          items={data.items}
          records={data.records}
          statistics={data.statistics}
          sportsClubs={data.clubs}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          activeFeature={activeFeature}
          onFeatureChange={setActiveFeature}
        />
      </div>

      <div className="w-full">
        {renderTabContent}
      </div>
    </div>
  );
}
