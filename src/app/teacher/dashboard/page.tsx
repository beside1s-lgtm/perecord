
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
  const [activeTab, setActiveTab] = useState("measurement");
  const router = useRouter();

  // 캐시 키 설정
  const getCacheKey = useCallback(() => `pe_dash_cache_${school}`, [school]);

  const load = useCallback(async (force = false) => {
    if (!school) return;
    
    // 1. 캐시 확인 (강제 로드가 아닐 때)
    if (!force) {
      const cachedData = sessionStorage.getItem(getCacheKey());
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setData(parsed);
          setIsLoading(false);
          // 캐시 히트 후 백그라운드에서 records와 students(전체) 최신화
          Promise.all([getRecords(school), getStudents(school)]).then(([records, students]) => {
            setData(prev => ({ ...prev, records, students }));
          }).catch(() => {});
          return;
        } catch (e) {
          sessionStorage.removeItem(getCacheKey());
        }
      }
    }

    // 2. 서버에서 데이터 가져오기 (signIn을 한 번만 호출하여 중복 오버헤드 제거)
    if (!force) setIsLoading(true);
    try {
      await signIn(); // 한 번만 인증하여 아래 Promise.all의 각 함수가 이미 인증된 상태로 실행됨
      // 필터 및 화면 레이아웃 구성용 필수 기초 데이터만 1차로 로딩
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
      
      // 기초 데이터 로드 완료 즉시 스켈레톤 해제하여 대시보드 표시
      if (!force) setIsLoading(false);

      // 무거운 기록 데이터와 통계 데이터는 백그라운드에서 병렬 로드
      Promise.all([
        getRecords(school),
        getStatistics(school)
      ]).then(([records, statistics]) => {
        setData(prev => {
          const updated = { ...prev, records, statistics };
          
          // 백그라운드 로드가 완료된 후 캐시 갱신 (records 및 건강기록부 무거운 필드 제외)
          try {
            const lightStudents = updated.students.map(s => ({
              id: s.id, name: s.name, grade: s.grade, classNum: s.classNum,
              studentNum: s.studentNum, gender: s.gender, personalCode: s.personalCode,
              school: s.school, guardianName: s.guardianName,
              residentRegistrationNumber: s.residentRegistrationNumber,
              bloodType: s.bloodType, officialSchoolName: s.officialSchoolName,
              schoolHistory: s.schoolHistory,
            }));
            const cacheData = { ...updated, records: [], students: lightStudents };
            sessionStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
          } catch (e) {
            sessionStorage.removeItem(getCacheKey());
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
     if (activeTab) {
       const url = new URL(window.location.href);
       url.searchParams.set('tab', activeTab);
       router.replace(url.pathname + url.search, { scroll: false });
     }
  }, [activeTab, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) setActiveTab(tab);
    }
  }, []);

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
           key={activeTab}
           variants={tabVariants}
           initial="initial"
           animate="animate"
           exit="exit"
           className="w-full"
        >
          <TabsContent value="measurement" className="space-y-6 mt-0">
            <Tabs defaultValue="input">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/30 p-1 rounded-xl h-auto sm:h-12 border border-border/50">
                <TabsTrigger value="input" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">입력</TabsTrigger>
                <TabsTrigger value="analysis" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">분석</TabsTrigger>
                <TabsTrigger value="browser" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">조회</TabsTrigger>
                <TabsTrigger value="ranking" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">순위</TabsTrigger>
              </TabsList>
              <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>}>
                <TabsContent value="input">
                  <RecordInput allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={handleRecordUpdate} allTeamGroups={data.teams} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="analysis">
                  <ClassAnalytics allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={handleRecordUpdate} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="browser">
                  <RecordBrowser allStudents={data.students} allItems={data.items} allRecords={data.records} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="ranking">
                  <Ranking allStudents={data.students} allItems={data.items} allRecords={data.records} sportsClubs={data.clubs} />
                </TabsContent>
              </Suspense>
            </Tabs>
          </TabsContent>

          <TabsContent value="theory" className="mt-0">
            <TheoryExamManagement allStudents={data.students} sportsClubs={data.clubs} />
          </TabsContent>

          <TabsContent value="competition" className="space-y-6 mt-0">
            <Tabs defaultValue="tournament">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/30 p-1 rounded-xl h-auto sm:h-12 border border-border/50">
                <TabsTrigger value="tournament" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">대회</TabsTrigger>
                <TabsTrigger value="balancer" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">편성</TabsTrigger>
                <TabsTrigger value="clubs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">클럽</TabsTrigger>
              </TabsList>
              <Suspense fallback={<Loader2 className="animate-spin mx-auto" />}>
                <TabsContent value="tournament">
                  <TournamentManagement onTournamentUpdate={handleTournamentUpdate} allTeamGroups={data.teams} allStudents={data.students} />
                </TabsContent>
                <TabsContent value="balancer">
                  <TeamBalancer allStudents={data.students} allItems={data.items} allRecords={data.records} teamGroups={data.teams} onTeamGroupUpdate={handleTeamGroupUpdate} onTeamGroupDelete={handleTeamGroupDelete} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="clubs">
                  <SportsClubManagement allStudents={data.students} sportsClubs={data.clubs} onClubUpdate={handleClubUpdate} />
                </TabsContent>
              </Suspense>
            </Tabs>
          </TabsContent>

          <TabsContent value="data" className="space-y-6 mt-0">
            <Tabs defaultValue="students">
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-muted/30 p-1 rounded-xl h-auto sm:h-12 border border-border/50">
                <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">명부</TabsTrigger>
                <TabsTrigger value="items" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">종목</TabsTrigger>
                <TabsTrigger value="db" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">DB</TabsTrigger>
                <TabsTrigger value="health-record" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">건강기록부</TabsTrigger>
              </TabsList>
              <Suspense fallback={<Loader2 className="animate-spin mx-auto" />}>
                <TabsContent value="students">
                  <StudentManagement students={data.students} onStudentsUpdate={() => load(true)} />
                </TabsContent>
                <TabsContent value="items">
                  <MeasurementManagement items={data.items} onItemsUpdate={(newItems) => setData(prev => ({...prev, items: newItems}))} />
                </TabsContent>
                <TabsContent value="db">
                  <DatabaseManagement students={data.students} records={data.records} items={data.items} onUpdate={() => load(true)} />
                </TabsContent>
                <TabsContent value="health-record">
                  <HealthRecordManagement students={data.students} items={data.items} records={data.records} onUpdate={() => load(true)} />
                </TabsContent>
              </Suspense>
            </Tabs>
          </TabsContent>
        </motion.div>
      </AnimatePresence>
    );
  }, [isLoading, isAuthLoading, data, load, activeTab]);

  if (isAuthLoading) return <DashboardSkeleton />;

  return (
    <div className="container mx-auto p-2 sm:p-10 space-y-6 sm:space-y-8 pb-32">
      <div className="no-print">
        <DashboardHeader 
          onStatsRebuilt={() => load(true)}
          allStudents={data.students}
          items={data.items}
          records={data.records}
          statistics={data.statistics}
          sportsClubs={data.clubs}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex items-center justify-start overflow-x-auto hide-scrollbar w-full mb-10 h-16 sm:h-20 p-2 bg-muted/20 border border-border/40 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-md shadow-inner gap-2 sm:gap-3 no-print">
          <TabsTrigger value="measurement" className="flex-1 min-w-[130px] h-full rounded-[1rem] sm:rounded-[2rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all">
            <LineChart className="w-5 h-5 sm:w-6 sm:h-6" />
            측정 & 분석
          </TabsTrigger>
          <TabsTrigger value="theory" className="flex-1 min-w-[130px] h-full rounded-[1rem] sm:rounded-[2rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            이론 평가
          </TabsTrigger>
          <TabsTrigger value="competition" className="flex-1 min-w-[130px] h-full rounded-[1rem] sm:rounded-[2rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all">
            <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
            대회 & 팀
          </TabsTrigger>
          <TabsTrigger value="data" className="flex-1 min-w-[130px] h-full rounded-[1rem] sm:rounded-[2rem] text-sm sm:text-lg font-black tracking-tight flex items-center justify-center gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-2xl transition-all">
            <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            데이터 관리
          </TabsTrigger>
        </TabsList>

        <Suspense fallback={<DashboardSkeleton />}>
           {renderTabContent}
        </Suspense>
      </Tabs>
    </div>
  );
}
