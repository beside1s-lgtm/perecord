"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw, Bot, Sparkles, Activity, SlidersHorizontal, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { rebuildAllStatistics } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AiIntelligenceCenterDialog } from "@/app/teacher/dashboard/_components/AiIntelligenceCenterDialog";
import type { Student, MeasurementItem, MeasurementRecord, ItemStatistics, SportsClub } from "@/lib/types";

export const CATEGORIES = [
  { label: '측정 & 분석', value: 'measurement' },
  { label: '이론 평가', value: 'theory' },
  { label: '대회 & 팀', value: 'competition' },
  { label: '데이터 관리', value: 'data' },
];

export const FEATURES_BY_CATEGORY: Record<string, { label: string; value: string }[]> = {
  measurement: [
    { label: '기록 입력', value: 'input' },
    { label: '통계 분석', value: 'analysis' },
    { label: '기록 조회', value: 'browser' },
    { label: '학급 순위', value: 'ranking' },
  ],
  theory: [
    { label: '이론 시험/평가', value: 'theory' },
  ],
  competition: [
    { label: '대회 관리', value: 'tournament' },
    { label: '팀 편성', value: 'balancer' },
    { label: '스포츠 클럽', value: 'clubs' },
  ],
  data: [
    { label: '학생 명부', value: 'students' },
    { label: '측정 종목', value: 'items' },
    { label: '데이터베이스', value: 'db' },
    { label: '건강기록부', value: 'health-record' },
  ],
};

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
  activeCategory?: string;
  onCategoryChange?: (cat: string) => void;
  activeFeature?: string;
  onFeatureChange?: (feat: string) => void;
}

export function DashboardHeader({ 
  onStatsRebuilt,
  allStudents = [],
  items = [],
  records = [],
  statistics = [],
  sportsClubs = [],
  activeCategory = 'measurement',
  onCategoryChange,
  activeFeature = 'input',
  onFeatureChange,
}: DashboardHeaderProps) {
  const { user, school, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isAiCenterOpen, setIsAiCenterOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);

  // 담당 학년 설정 상태 (로컬 스토리지 보존)
  const [assignedGrades, setAssignedGrades] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['5', '6'];
    try {
      const saved = localStorage.getItem(`perecord_assigned_grades_${school}`);
      return saved ? JSON.parse(saved) : ['5', '6'];
    } catch {
      return ['5', '6'];
    }
  });

  const availableGrades = useMemo(() => {
    const list = [...new Set(allStudents.map(s => s.grade))].sort((a, b) => parseInt(a) - parseInt(b));
    return list.length > 0 ? list : ['3', '4', '5', '6'];
  }, [allStudents]);

  const assignedStudentCount = useMemo(() => {
    if (!allStudents.length) return 0;
    return allStudents.filter(s => assignedGrades.includes(s.grade)).length;
  }, [allStudents, assignedGrades]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleThemeChange = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const handleSaveAssignedGrades = (newGrades: string[]) => {
    setAssignedGrades(newGrades);
    try {
      localStorage.setItem(`perecord_assigned_grades_${school}`, JSON.stringify(newGrades));
      toast({ title: '담당 학년 설정 완료', description: `담당 학년이 [${newGrades.join(', ')}학년]으로 저장되었습니다.` });
    } catch {}
    setIsAssignmentDialogOpen(false);
  };

  const handleRebuildStats = async () => {
    if (!school || isRebuilding) return;
    setIsRebuilding(true);
    try {
      await rebuildAllStatistics(school);
      toast({
        title: "통계 재계산 완료",
        description: "학생 페이지에 최신 측정 기록이 반영되었습니다.",
      });
      onStatsRebuilt?.();
    } catch (e) {
      toast({ variant: "destructive", title: "재계산 실패", description: "잠시 후 다시 시도해주세요." });
    } finally {
      setIsRebuilding(false);
    }
  };

  // 현재 카테고리에 속한 기능 목록
  const currentFeatures = FEATURES_BY_CATEGORY[activeCategory] || FEATURES_BY_CATEGORY.measurement;

  const handleCategorySelect = (newCat: string) => {
    onCategoryChange?.(newCat);
    const features = FEATURES_BY_CATEGORY[newCat];
    if (features && features.length > 0) {
      onFeatureChange?.(features[0].value);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 w-full max-w-full border-b bg-card/90 px-2 sm:px-4 py-2 sm:py-2.5 backdrop-blur-md shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          
          {/* 1. 좌측: 로고 + 시스템 명칭 + 담당 학년/인원 뱃지 */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs flex-shrink-0">
              <Activity className="h-4 w-4" />
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black text-foreground font-headline tracking-tight whitespace-nowrap">
              학교 체육 성장 기록
            </h1>

            {/* 담당 학년 및 인원 뱃지 */}
            <Badge 
              variant="secondary" 
              className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 bg-muted/70 hover:bg-muted text-muted-foreground border border-border/60 cursor-pointer transition-colors"
              onClick={() => setIsAssignmentDialogOpen(true)}
              title="클릭하여 담당 학년 설정"
            >
              <span>담당 {assignedGrades.length > 0 ? `${assignedGrades.join(',')}` : '미지정'}학년</span>
              <span className="text-foreground/75 font-bold">
                ({assignedStudentCount}명 / 전체 {allStudents.length || 0}명)
              </span>
            </Badge>
          </div>

          {/* 2. 우측: [구분: 측정 & 분석 v] [기능: 기록 입력 v] [담당 설정] [AI 인텔리전스] [새로고침] */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 flex-shrink-0 ml-auto">
            
            {/* 구분 드롭다운 */}
            {onCategoryChange && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline font-semibold text-[11px]">구분:</span>
                <Select value={activeCategory} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="h-8 w-[105px] sm:w-[125px] text-xs font-bold bg-background border-border/80 shadow-2xs">
                    <SelectValue placeholder="구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value} className="text-xs font-semibold">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 기능 드롭다운 */}
            {onFeatureChange && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="hidden sm:inline font-semibold text-[11px]">기능:</span>
                <Select value={activeFeature} onValueChange={onFeatureChange}>
                  <SelectTrigger className="h-8 w-[105px] sm:w-[125px] text-xs font-bold bg-background border-border/80 shadow-2xs">
                    <SelectValue placeholder="기능 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentFeatures.map(feat => (
                      <SelectItem key={feat.value} value={feat.value} className="text-xs font-semibold">
                        {feat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 담당 설정 버튼 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignmentDialogOpen(true)}
              className="h-8 px-2 sm:px-2.5 text-xs font-semibold border-border/80 hover:bg-muted text-foreground flex items-center gap-1.5 shadow-2xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">담당 설정</span>
            </Button>

            {/* AI 인텔리전스 센터 버튼 */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAiCenterOpen(true)}
              className="flex items-center gap-1.5 h-8 px-2.5 sm:px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-all text-xs"
              title="AI 인텔리전스 센터"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline font-black">AI 인텔리전스</span>
              <Sparkles className="h-3 w-3 text-amber-300 hidden sm:inline" />
            </Button>

            {/* 통계 재계산(새로고침) 버튼 */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleRebuildStats}
                    disabled={isRebuilding}
                    className="h-8 w-8 border-border/80 hover:bg-muted text-foreground"
                    title="통계 재계산 및 최신화"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRebuilding ? "animate-spin text-primary" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-center">
                  <p className="text-xs">통계 재계산 및 데이터 새로고침</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* 다크모드 스위치 */}
            {isMounted && (
              <div className="hidden xl:flex items-center space-x-1 pl-1">
                <Switch
                  id="theme-switch"
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeChange}
                  className="scale-75"
                />
              </div>
            )}

            {/* 사용자 정보 및 로그아웃 */}
            <div className="flex items-center gap-1 pl-1 border-l border-border/50">
              <span className="text-[11px] font-bold text-muted-foreground hidden lg:inline max-w-[90px] truncate" title={user?.name}>
                {user?.name}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} className="h-7 w-7 text-muted-foreground hover:text-destructive" title="로그아웃">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 담당 학년 설정 다이얼로그 */}
      <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              담당 학년 설정
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              교사님이 담당하시는 학년을 선택하세요. 상단 뱃지와 통계에 담당 학년 정보가 반영됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {availableGrades.map(grade => {
                const isSelected = assignedGrades.includes(grade);
                const count = allStudents.filter(s => s.grade === grade).length;
                return (
                  <Button
                    key={grade}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className="flex flex-col h-16 justify-center items-center gap-1 p-2"
                    onClick={() => {
                      if (isSelected) {
                        setAssignedGrades(assignedGrades.filter(g => g !== grade));
                      } else {
                        setAssignedGrades([...assignedGrades, grade].sort());
                      }
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm">{grade}학년</span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-[10px] font-normal opacity-80">{count}명</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" size="sm" onClick={() => setAssignedGrades(availableGrades)}>
              전체 학년 선택
            </Button>
            <Button size="sm" onClick={() => handleSaveAssignedGrades(assignedGrades)} className="font-bold">
              설정 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 인텔리전스 센터 모달 */}
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
