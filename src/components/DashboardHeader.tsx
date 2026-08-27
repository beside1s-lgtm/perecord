"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle, RefreshCw, Bot, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from 'next/image';
import { rebuildAllStatistics } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiIntelligenceCenterDialog } from "@/app/teacher/dashboard/_components/AiIntelligenceCenterDialog";
import type { Student, MeasurementItem, MeasurementRecord, ItemStatistics, SportsClub } from "@/lib/types";

export function DashboardHeaderContents() {
  const { school } = useAuth();
  return (
    <h1 className="text-2xl md:text-3xl font-bold mb-6 text-primary font-headline">
      {school} 교사 대시보드
    </h1>
  );
}

interface DashboardHeaderProps {
  onStatsRebuilt?: () => void;
  allStudents?: Student[];
  items?: MeasurementItem[];
  records?: MeasurementRecord[];
  statistics?: ItemStatistics[];
  sportsClubs?: SportsClub[];
}

export function DashboardHeader({ 
  onStatsRebuilt,
  allStudents = [],
  items = [],
  records = [],
  statistics = [],
  sportsClubs = []
}: DashboardHeaderProps) {
  const { user, school, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isAiCenterOpen, setIsAiCenterOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const handleRebuildStats = async () => {
    if (!school || isRebuilding) return;
    setIsRebuilding(true);
    try {
      await rebuildAllStatistics(school);
      toast({
        title: "✅ 통계 재계산 완료",
        description: "학생 페이지에 최신 측정 기록이 반영되었습니다.",
      });
      onStatsRebuilt?.();
    } catch (e) {
      toast({ variant: "destructive", title: "재계산 실패", description: "잠시 후 다시 시도해주세요." });
    } finally {
      setIsRebuilding(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/80 px-2 sm:px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <Image src="/200x200.png" alt="Logo" width={24} height={24} className="rounded-md" />
          <h1 className="hidden sm:block text-base md:text-lg font-bold text-primary font-headline tracking-tight">
            체육 성장 기록 시스템
          </h1>

          {/* AI 인텔리전스 센터 바로가기 버튼 */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAiCenterOpen(true)}
            className="flex items-center gap-1.5 h-8 px-2.5 sm:px-3 bg-gradient-to-r from-primary via-blue-600 to-indigo-600 hover:from-primary/90 hover:to-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <Bot className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-black">AI 인텔리전스 센터</span>
            <Sparkles className="h-3 w-3 text-amber-300 hidden sm:inline" />
          </Button>
        </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 통계 재계산 버튼 */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRebuildStats}
                disabled={isRebuilding}
                className="flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${isRebuilding ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline text-xs font-semibold">
                  {isRebuilding ? "재계산 중..." : "통계 재계산"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px] text-center">
              <p className="text-xs">측정 기록 입력 후 학생 페이지에 반영하려면 클릭하세요</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* 다크모드 토글 */}
        {isMounted && (
          <div className="flex items-center space-x-2">
            <Label htmlFor="theme-switch" className="hidden sm:inline">
              {theme === "dark" ? "다크 모드" : "라이트 모드"}
            </Label>
            <Switch
              id="theme-switch"
              checked={theme === "dark"}
              onCheckedChange={handleThemeChange}
            />
          </div>
        )}
        <div className="flex items-center gap-2 text-sm font-medium">
          <UserCircle className="h-5 w-5" />
          <span className="hidden md:inline">
            {user?.school} {user?.name}님
          </span>
          <span className="md:hidden">{user?.name}님</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="px-2">
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    </header>

    <AiIntelligenceCenterDialog
      open={isAiCenterOpen}
      onOpenChange={setIsAiCenterOpen}
      allStudents={allStudents}
      items={items}
      records={records}
      statistics={statistics}
      sportsClubs={sportsClubs}
    />
  </>
  );
}
