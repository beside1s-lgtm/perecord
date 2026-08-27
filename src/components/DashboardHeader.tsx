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
      <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full max-w-full items-center justify-between border-b bg-card/80 px-2 sm:px-6 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-shrink">
          <Image src="/200x200.png" alt="Logo" width={22} height={22} className="rounded-md flex-shrink-0" />
          <h1 className="text-xs sm:text-base md:text-lg font-bold text-primary font-headline tracking-tight whitespace-nowrap">
            <span className="inline sm:hidden font-black">체육성장시스템</span>
            <span className="hidden sm:inline">체육 성장 기록 시스템</span>
          </h1>

          {/* AI 인텔리전스 센터 바로가기 버튼 */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsAiCenterOpen(true)}
            className="flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-3 bg-gradient-to-r from-primary via-blue-600 to-indigo-600 hover:from-primary/90 hover:to-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
            title="AI 인텔리전스 센터"
          >
            <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="hidden sm:inline text-xs font-black">AI 인텔리전스 센터</span>
            <Sparkles className="h-3 w-3 text-amber-300 hidden sm:inline" />
          </Button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
          {/* 통계 재계산 버튼 */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRebuildStats}
                  disabled={isRebuilding}
                  className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 transition-all"
                  title="통계 재계산"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRebuilding ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline text-xs font-semibold">
                    {isRebuilding ? "재계산..." : "통계 재계산"}
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
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Label htmlFor="theme-switch" className="hidden lg:inline text-xs">
                {theme === "dark" ? "다크" : "라이트"}
              </Label>
              <Switch
                id="theme-switch"
                checked={theme === "dark"}
                onCheckedChange={handleThemeChange}
                className="scale-90 sm:scale-100"
              />
            </div>
          )}

          <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-foreground/85 px-1.5 py-0.5 rounded-md bg-muted/50 max-w-[80px] sm:max-w-none truncate flex-shrink-0" title={`${user?.school || ''} ${user?.name || ''}`}>
            <UserCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-primary" />
            <span className="truncate inline md:hidden">{user?.name}</span>
            <span className="truncate hidden md:inline">{user?.school} {user?.name}님</span>
          </div>

          <Button variant="ghost" size="sm" onClick={logout} className="h-8 px-1.5 sm:px-2 text-xs flex-shrink-0" title="로그아웃">
            <LogOut className="h-4 w-4 sm:mr-1" />
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
