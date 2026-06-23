
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
import MeasurementManagement from "./_components/MeasurementManagement";
import ClassAnalytics from "./_components/ClassAnalytics";
import RecordBrowser from "./_components/RecordBrowser";
import Ranking from "./_components/Ranking";
import RecordInput from "./_components/RecordInput";
import AiWelcome from "./_components/AiWelcome";
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
          console.log("Using cached dashboard data for school:", school);
          // 캐시 히트 후 백그라운드에서 records만 최신화
          getRecords(school).then(records => {
            setData(prev => ({ ...prev, records }));
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
      const [students, items, records, teams, clubs, statistics] = await Promise.all([
        getStudents(school), 
        getItems(school), 
        getRecords(school), 
        getTeamGroups(school), 
        getSportsClubs(school),
        getStatistics(school)
      ]);
      const newData = { students, items, records, teams, clubs, statistics };
      setData(newData);
      
      // 3. 캐시 저장 (records는 제외하여 Quota 오류 방지, 대신 매번 백그라운드 최신화)
      try {
        const cacheData = { ...newData, records: [] };
        sessionStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
        console.log("Dashboard data updated from Firestore.");
      } catch (e) {
        console.warn("Session storage quota exceeded, skipping cache.");
        sessionStorage.removeItem(getCacheKey());
      }
    } catch (e) {
      console.error("Teacher dashboard load failed", e);
    } finally {
      setIsLoading(false);
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
                  <RecordInput allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={() => load(true)} allTeamGroups={data.teams} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="analysis">
                  <ClassAnalytics allStudents={data.students} allItems={data.items} allRecords={data.records} onRecordUpdate={() => load(true)} sportsClubs={data.clubs} />
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
                  <TournamentManagement onTournamentUpdate={() => load(true)} allTeamGroups={data.teams} allStudents={data.students} />
                </TabsContent>
                <TabsContent value="balancer">
                  <TeamBalancer allStudents={data.students} allItems={data.items} allRecords={data.records} teamGroups={data.teams} onTeamGroupUpdate={() => load(true)} onTeamGroupDelete={() => load(true)} sportsClubs={data.clubs} />
                </TabsContent>
                <TabsContent value="clubs">
                  <SportsClubManagement allStudents={data.students} sportsClubs={data.clubs} onClubUpdate={() => load(true)} />
                </TabsContent>
              </Suspense>
            </Tabs>
          </TabsContent>

          <TabsContent value="data" className="space-y-6 mt-0">
            <Tabs defaultValue="students">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/30 p-1 rounded-xl h-auto sm:h-12 border border-border/50">
                <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">명부</TabsTrigger>
                <TabsTrigger value="items" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">종목</TabsTrigger>
                <TabsTrigger value="db" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">DB</TabsTrigger>
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
              </Suspense>
            </Tabs>
          </TabsContent>
        </motion.div>
      </AnimatePresence>
    );
  }, [isLoading, isAuthLoading, data, load, activeTab]);

  if (isAuthLoading) return <DashboardSkeleton />;

  return (

    <div className="container mx-auto p-2 sm:p-10 space-y-8 sm:space-y-12 pb-32">
      <DashboardHeader onStatsRebuilt={() => load(true)} />
      
      <Card className="premium-card bg-primary/[0.04] border-primary/20 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform group-hover:scale-125 duration-700" />
        <CardHeader className="pb-4 relative z-10">
          <CardTitle className="flex items-center gap-3 text-primary font-headline text-2xl sm:text-3xl">
            <Bot className="h-8 w-8 text-primary/80 animate-pulse" />
            <span className="premium-gradient-text tracking-tighter">AI 인텔리전스 센터</span>
          </CardTitle>
          <CardDescription className="text-base font-bold opacity-70">실시간 데이터 수집 및 고성능 AI 모형을 통한 학교 체육 통합 분석 리포트를 제공합니다.</CardDescription>
        </CardHeader>
        <CardContent className="relative z-10 pt-2">
          <AiWelcome 
            title="학교 전체 AI 지능형 리포트 확인" 
            allStudents={data.students} 
            items={data.items} 
            records={data.records} 
            statistics={data.statistics}
          />
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex items-center justify-start overflow-x-auto hide-scrollbar w-full mb-10 h-16 sm:h-20 p-2 bg-muted/20 border border-border/40 rounded-[1.5rem] sm:rounded-[2.5rem] backdrop-blur-md shadow-inner gap-2 sm:gap-3">
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
