
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
import { exportToExcel } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Youtube, Eye, EyeOff, ClipboardList, Loader2, Calculator, Save, Search, Calendar as CalendarIcon, X, Download, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards, BMI_EVALUATION_STANDARDS, getBmiGrade, getBmiStatusText } from '@/lib/paps';

interface RecordInputProps {
    allStudents: Student[];
    allItems: MeasurementItem[];
    allRecords: MeasurementRecord[];
    onRecordUpdate: (records: MeasurementRecord[] | string, action: 'update' | 'delete') => void;
    allTeamGroups: TeamGroup[];
    sportsClubs: SportsClub[];
}

const calculateBmi = (height?: string, weight?: string) => {
    const h = parseFloat(height || '');
    const w = parseFloat(weight || '');
    if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
        const hMeter = h / 100;
        return (w / (hMeter * hMeter)).toFixed(2);
    }
    return '';
};

export default function RecordInput({ allStudents, allItems, allRecords, onRecordUpdate, allTeamGroups, sportsClubs }: RecordInputProps) {
  const { school } = useAuth();
  const { toast } = useToast();
  
  const activeItems = useMemo(() => {
    const weekItems = allItems.filter(item => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated);
    if (weekItems.length > 0) return weekItems;
    return allItems.filter(item => !item.isArchived && !item.isDeactivated);
  }, [allItems]);
  const { grades, classNumsByGrade } = useMemo(() => {
    const gradesList = [...new Set(allStudents.map(s => s.grade))].sort((a, b) => parseInt(a) - parseInt(b));
    const classMap: Record<string, string[]> = {};
    gradesList.forEach(grade => {
        classMap[grade] = [...new Set(allStudents.filter(s => s.grade === grade).map(s => s.classNum))].sort((a, b) => parseInt(a) - parseInt(b));
    });
    return { grades: gradesList, classNumsByGrade: classMap };
  }, [allStudents]);

  const [activeTab, setActiveTab] = useState('batch');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [recordValue, setRecordValue] = useState('');
  const [recordDate, setRecordDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState(''); 
  const [batchRecordItem, setBatchRecordItem] = useState('');
  const [batchRecordDate, setBatchRecordDate] = useState<Date | undefined>(new Date());
  const [batchRecords, setBatchRecords] = useState<Record<string, { value?: string, height?: string, weight?: string }>>({});
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [showVideo, setShowVideo] = useState(false);
  const [showGradeTable, setShowGradeTable] = useState(false);
  const [guideTab, setGuideTab] = useState<'side' | 'standards' | 'video'>('side');
  const [bmiGenderFilter, setBmiGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  useEffect(() => {
    if (activeItems.length > 0) {
        if (!selectedItemName) {
            const firstPaps = activeItems.find(i => i.isPaps);
            setSelectedItemName(firstPaps?.name || activeItems[0].name);
        }
        if (!batchRecordItem) {
            const firstPaps = activeItems.find(i => i.isPaps);
            setBatchRecordItem(firstPaps?.name || activeItems[0].name);
        }
    }
  }, [activeItems, selectedItemName, batchRecordItem]);

  const studentsForBatch = useMemo(() => {
    let list: Student[] = [];
    if (selectedGroupId) {
        const teamGroup = allTeamGroups.find(g => g.id === selectedGroupId);
        if (teamGroup) {
            const memberIds = teamGroup.teams.flatMap(t => t.memberIds);
            list = allStudents.filter(s => memberIds.includes(s.id));
        } else {
            const club = sportsClubs.find(c => c.id === selectedGroupId);
            if (club) list = allStudents.filter(s => club.memberIds.includes(s.id));
        }
    } else if (selectedGrade) {
        list = allStudents.filter(s => s.grade === selectedGrade && (selectedClassNum === 'all' || s.classNum === selectedClassNum));
    }
    return list.sort((a,b) => {
        if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
        if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
        return parseInt(a.studentNum) - parseInt(b.studentNum);
    });
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, allTeamGroups, sportsClubs]);

  const selectedItemForBatch = useMemo(() => allItems.find(item => item.name === batchRecordItem) || activeItems.find(item => item.name === batchRecordItem), [batchRecordItem, allItems, activeItems]);
  const selectedItemForSingle = useMemo(() => allItems.find(item => item.name === selectedItemName) || activeItems.find(item => item.name === selectedItemName), [selectedItemName, allItems, activeItems]);

  const batchStats = useMemo(() => {
    if (!studentsForBatch.length) return { total: 0, completed: 0, percentage: 0 };
    const targetDateStr = batchRecordDate ? format(batchRecordDate, 'yyyy-MM-dd') : '';
    let count = 0;
    studentsForBatch.forEach(s => {
      const hasInput = !!batchRecords[s.id]?.value || (!!batchRecords[s.id]?.height && !!batchRecords[s.id]?.weight);
      const hasRecord = allRecords.some(r => r.studentId === s.id && r.item === batchRecordItem && r.date === targetDateStr);
      if (hasInput || hasRecord || savedIds.has(s.id)) count++;
    });
    const pct = Math.round((count / studentsForBatch.length) * 100);
    return { total: studentsForBatch.length, completed: count, percentage: pct };
  }, [studentsForBatch, batchRecords, allRecords, batchRecordItem, batchRecordDate, savedIds]);

  // 그룹이나 종목 변경 시 기록 입력 초기화
  useEffect(() => {
    const isCompound = selectedItemForBatch?.isCompound;
    const newBatchRecords: Record<string, { value?: string, height?: string, weight?: string }> = {};
    
    if (isCompound && studentsForBatch.length > 0) {
      studentsForBatch.forEach(s => {
        const prev = getPreviousRecord(s.id, batchRecordItem);
        if (prev && prev.height && prev.weight) {
          newBatchRecords[s.id] = {
            height: prev.height.toString(),
            weight: prev.weight.toString()
          };
        }
      });
    }
    
    setBatchRecords(newBatchRecords);
    setSavedIds(new Set());
  }, [selectedGrade, selectedClassNum, batchRecordItem, selectedGroupId]); // studentsForBatch 제거하여 단순 데이터 갱신 시 초기화 방지

  // 개별 기록 탭에서 학생 선택 시 BMI 초기 데이터 로딩
  useEffect(() => {
    if (selectedStudent && selectedItemForSingle?.isCompound) {
      const prev = getPreviousRecord(selectedStudent.id, selectedItemName);
      if (prev && prev.height && prev.weight && !batchRecords[selectedStudent.id]) {
        setBatchRecords(prevMap => ({
          ...prevMap,
          [selectedStudent.id]: {
            height: prev.height?.toString(),
            weight: prev.weight?.toString()
          }
        }));
      }
    }
  }, [selectedStudent, selectedItemName, selectedItemForSingle]);

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    const found = allStudents.filter(s => s.name.includes(searchTerm.trim()));
    if (found.length === 1) {
      setSelectedStudent(found[0]);
      setFoundStudents([]);
      setSearchTerm('');
    } else if (found.length > 1) {
      setFoundStudents(found);
      setIsSelectionDialogOpen(true);
    } else {
      toast({ variant: "destructive", title: "학생을 찾을 수 없습니다." });
    }
  };

  const getPreviousRecord = (studentId: string, itemName: string) => {
    return allRecords
      .filter(r => r.studentId === studentId && r.item === itemName)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const calculateBmi = (heightCm?: string, weightKg?: string): string => {
    const h = parseFloat(heightCm || '');
    const w = parseFloat(weightKg || '');
    if (!isNaN(h) && !isNaN(w) && h > 0 && w > 0) {
        const heightInMeters = h / 100;
        return (w / (heightInMeters * heightInMeters)).toFixed(2);
    }
    return '';
  };

  const handleIndividualSave = async (studentId: string) => {
    if (!school || !batchRecordItem || !batchRecordDate) return;
    
    const input = batchRecords[studentId];
    if (!input) {
        toast({ variant: 'destructive', title: '입력된 값이 없습니다.' });
        return;
    }

    let valueToSave: number | null = null;
    if (selectedItemForBatch?.isCompound) {
        const bmi = calculateBmi(input.height, input.weight);
        if (!bmi) {
            toast({ variant: 'destructive', title: '키와 몸무게를 올바르게 입력해주세요.' });
            return;
        }
        valueToSave = parseFloat(bmi);
    } else {
        if (!input.value) {
            toast({ variant: 'destructive', title: '기록을 입력해주세요.' });
            return;
        }
        valueToSave = parseFloat(input.value);
    }

    if (valueToSave === null || isNaN(valueToSave)) return;

    const targetDateStr = format(batchRecordDate, 'yyyy-MM-dd');
    // 메모리에 이미 로드된 기존 기록에서 ID를 0ms 만에 즉시 탐색 (서버 쿼리 1회 제거)
    const existing = allRecords.find(r => r.studentId === studentId && r.item === batchRecordItem && r.date === targetDateStr);
    const existingId = existing?.id;

    // 1. 낙관적 UI 즉각 반영 (체감 지연 0초)
    const optimisticRecord: MeasurementRecord = {
      id: existingId || `temp_${studentId}_${Date.now()}`,
      studentId,
      school,
      item: batchRecordItem,
      date: targetDateStr,
      value: valueToSave,
      height: input.height ? parseFloat(input.height) : undefined,
      weight: input.weight ? parseFloat(input.weight) : undefined
    };

    onRecordUpdate([optimisticRecord], 'update');
    setSavedIds(prev => new Set(prev).add(studentId));
    toast({ title: "저장 완료" });

    // 2. 백그라운드에서 Firestore 비동기 저장 (ID 전달로 getDocs 쿼리 없이 1회 쓰기만 실행)
    addOrUpdateRecord({ 
      id: existingId,
      studentId, 
      school, 
      item: batchRecordItem, 
      date: targetDateStr, 
      value: valueToSave,
      height: input.height ? parseFloat(input.height) : undefined,
      weight: input.weight ? parseFloat(input.weight) : undefined
    }).then(savedRec => {
      onRecordUpdate([savedRec], 'update');
    }).catch(e => {
      console.error("[handleIndividualSave] 백그라운드 저장 실패:", e);
      toast({ variant: "destructive", title: "저장 실패", description: "서버 저장 중 오류가 발생했습니다. 다시 시도해주세요." });
      setSavedIds(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    });
  };

  const handleSaveBatchRecords = async () => {
    if (!school || !batchRecordItem || !batchRecordDate) return;
    setIsBatchSubmitting(true);
    try {
        const toSave = studentsForBatch.map(s => {
            const input = batchRecords[s.id];
            if (!input) return null;
            let val: number | null = null;
            if (selectedItemForBatch?.isCompound) {
                const bmi = calculateBmi(input.height, input.weight);
                val = bmi ? parseFloat(bmi) : null;
            } else {
                val = input.value ? parseFloat(input.value) : null;
            }
            if (val === null || isNaN(val)) return null;
            return { 
                studentId: s.id, 
                school, 
                item: batchRecordItem, 
                value: val, 
                date: format(batchRecordDate, 'yyyy-MM-dd'),
                height: input.height ? parseFloat(input.height) : undefined,
                weight: input.weight ? parseFloat(input.weight) : undefined
            };
        }).filter((r): r is any => r !== null);

        if (toSave.length > 0) {
            const updated = await addOrUpdateRecords(school, studentsForBatch, toSave);
            onRecordUpdate(updated, 'update');
            setSavedIds(new Set(toSave.map(r => r.studentId)));
            toast({ title: '일괄 저장 완료' });
        }
    } finally { setIsBatchSubmitting(false); }
  };

  const handleDownloadTemplate = () => {
    if (studentsForBatch.length === 0) {
      toast({ variant: 'destructive', title: '다운로드 실패', description: '먼저 학년/반 또는 그룹을 선택해주세요.' });
      return;
    }
    
    if (!batchRecordItem) {
      toast({ variant: 'destructive', title: '다운로드 실패', description: '측정 종목을 선택해주세요.' });
      return;
    }

    const templateData = studentsForBatch.map(s => ({
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.studentNum,
      '이름': s.name,
      [batchRecordItem]: '',
      '비고': ''
    }));

    const filename = `${selectedGrade ? `${selectedGrade}학년_${selectedClassNum}반` : '그룹'}_${batchRecordItem}_입력템플릿`;
    exportToExcel(filename, templateData);
    toast({ title: '템플릿 다운로드 완료', description: '기록을 입력한 후 일괄 업로드 기능을 이용해 주세요.' });
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const renderGradeRanges = (gender: 'male' | 'female', isLarge: boolean = false) => {
    const gradeToUse = selectedGrade || (studentsForBatch[0]?.grade || '5');
    const itemKey = batchRecordItem === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : batchRecordItem;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    const textSize = isLarge ? "text-xs sm:text-sm" : "text-[10px]";
    if (!itemStandards) return <TableCell colSpan={5} className={cn("text-center text-muted-foreground", textSize)}>데이터 없음</TableCell>;
    const ranges = itemStandards[gender];
    const unit = selectedItemForBatch?.unit || '';
    return [1, 2, 3, 4, 5].map(g => {
        const r = ranges.find(range => range.grade === g);
        if (!r) return <TableCell key={g} className={cn("text-center", textSize)}>-</TableCell>;
        const text = r.max === Infinity ? `${r.min}${unit}↑` : (r.min === -Infinity || r.min === 0) ? `${r.max}${unit}↓` : `${r.min}~${r.max}${unit}`;
        return <TableCell key={g} className={cn("text-center font-semibold break-keep", isLarge ? "py-2.5 px-2 text-xs sm:text-sm" : "py-1 px-0.5 text-[9px] sm:text-[10px]")}>{text}</TableCell>;
    });
  };

  const isBmiBatchItem = batchRecordItem === '체질량지수(BMI)' || selectedItemForBatch?.name === '체질량지수(BMI)' || selectedItemForBatch?.isCompound;

  const renderBmiStandardsView = (isLarge: boolean = false) => {
    const currentGrade = selectedGrade || (studentsForBatch[0]?.grade || '5');
    const gradeNum = parseInt(currentGrade);
    const activeGradeKey = (!isNaN(gradeNum) && gradeNum >= 4 && gradeNum <= 6) ? String(gradeNum) : '5';

    const renderTableForGender = (gender: '남' | '여') => {
      const isMale = gender === '남';
      const title = isMale ? '1. 남학생 BMI 평가 기준표' : '2. 여학생 BMI 평가 기준표';
      const titleColor = isMale ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400';
      const borderAccent = isMale ? 'border-l-blue-500' : 'border-l-pink-500';
      const activeBg = isMale ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 font-bold' : 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-950 dark:text-pink-100 font-bold';
      const standardsObj = BMI_EVALUATION_STANDARDS[gender];
      const gradesToDisplay = ['4', '5', '6'];

      return (
        <div className="space-y-1 mb-2.5">
          <div className={cn("text-xs font-bold flex items-center justify-between px-1", titleColor)}>
            <span>{title}</span>
            <span className="text-[10px] text-muted-foreground font-normal">단위: kg/m²</span>
          </div>
          <div className="rounded-md border bg-background/90 overflow-hidden shadow-2xs">
            <Table className="w-full text-center table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 h-7">
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 w-[42px] sm:w-[50px] font-bold">학년</TableHead>
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 font-bold text-sky-600">마름(이하)</TableHead>
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 font-bold text-emerald-600">정상</TableHead>
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 font-bold text-amber-600">과체중</TableHead>
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 font-bold text-orange-600">경도비만</TableHead>
                  <TableHead className="text-center h-7 text-[10px] sm:text-[11px] p-0.5 font-bold text-rose-600">고도비만(이상)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradesToDisplay.map(g => {
                  const s = standardsObj[g];
                  const isCurrent = g === activeGradeKey;
                  return (
                    <TableRow 
                      key={g} 
                      className={cn(
                        "h-7 transition-colors hover:bg-muted/30", 
                        isCurrent && cn(activeBg, "border-l-4", borderAccent)
                      )}
                    >
                      <TableCell className={cn("text-center p-0.5 text-[10px] sm:text-[11px] font-bold", isCurrent && titleColor)}>
                        {g}학년{isCurrent && <span className="text-[9px] ml-0.5 font-normal">(선택)</span>}
                      </TableCell>
                      <TableCell className="p-0.5 text-[10px] sm:text-[11px] font-medium whitespace-nowrap">{s.leanMax} 이하</TableCell>
                      <TableCell className="p-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{s.normalMin} ~ {s.normalMax}</TableCell>
                      <TableCell className="p-0.5 text-[10px] sm:text-[11px] font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">{s.overweightMin} ~ {s.overweightMax}</TableCell>
                      <TableCell className="p-0.5 text-[10px] sm:text-[11px] font-medium text-orange-700 dark:text-orange-400 whitespace-nowrap">{s.mildObesityMin} ~ {s.mildObesityMax}</TableCell>
                      <TableCell className="p-0.5 text-[10px] sm:text-[11px] font-medium text-rose-700 dark:text-rose-400 whitespace-nowrap">{s.severeObesityMin} 이상</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-2">
        {/* 상단 성별 필터 탭 */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/50">
            <Button
              type="button"
              variant={bmiGenderFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] font-bold px-2 rounded shadow-2xs"
              onClick={() => setBmiGenderFilter('all')}
            >
              전체
            </Button>
            <Button
              type="button"
              variant={bmiGenderFilter === 'male' ? 'default' : 'ghost'}
              size="sm"
              className={cn("h-6 text-[10px] font-bold px-2 rounded", bmiGenderFilter !== 'male' && "text-blue-600")}
              onClick={() => setBmiGenderFilter('male')}
            >
              남학생
            </Button>
            <Button
              type="button"
              variant={bmiGenderFilter === 'female' ? 'default' : 'ghost'}
              size="sm"
              className={cn("h-6 text-[10px] font-bold px-2 rounded", bmiGenderFilter !== 'female' && "text-pink-600")}
              onClick={() => setBmiGenderFilter('female')}
            >
              여학생
            </Button>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">선택 학년: <strong className="text-foreground">{activeGradeKey}학년</strong></span>
        </div>

        {/* 안내 문구 */}
        <div className="p-1.5 sm:p-2 rounded-lg bg-muted/30 border border-border/50 text-[10px] text-muted-foreground space-y-0.5 leading-relaxed">
          <p className="font-semibold text-foreground">※ 체질량지수(BMI) = 체중(kg) / [키(m)]² (소수 첫째 자리 반올림 적용)</p>
          <p>※ PAPS 등급: <span className="text-emerald-600 font-bold">1등급(정상)</span> | <span className="text-amber-600 font-bold">2등급(과체중)</span> | <span className="text-sky-600 font-bold">3등급(마름)</span> | <span className="text-orange-600 font-bold">4등급(경도비만)</span> | <span className="text-rose-600 font-bold">5등급(고도비만)</span></p>
        </div>

        {/* 기준표 테이블 렌더링 */}
        {(bmiGenderFilter === 'all' || bmiGenderFilter === 'male') && renderTableForGender('남')}
        {(bmiGenderFilter === 'all' || bmiGenderFilter === 'female') && renderTableForGender('여')}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>학생 선택</DialogTitle></DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                      <TableHeader><TableRow><TableHead>이름</TableHead><TableHead>학년-반</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                          {foundStudents.map((s) => (
                              <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.grade}-{s.classNum}</TableCell><TableCell><Button size="sm" onClick={() => { setSelectedStudent(s); setIsSelectionDialogOpen(false); setSearchTerm(''); }}>선택</Button></TableCell></TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>
          </DialogContent>
      </Dialog>

      <div className="w-full space-y-2">
        {/* 상단 캡처 일체형 액션바: 좌측 [학급/팀별 | 개별 학생] + 우측 [필터 & 저장 컨트롤] */}
        <div className="border rounded-xl bg-card/80 p-1.5 sm:p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs backdrop-blur-sm">
          {/* 1. 좌측: 서브 탭 세그먼트 버튼 (학급/팀별 vs 개별 학생) */}
          <div className="flex items-center bg-muted/70 p-0.5 rounded-lg border border-border/50">
            <Button
              type="button"
              variant={activeTab === 'batch' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-bold px-3 rounded-md shadow-2xs"
              onClick={() => setActiveTab('batch')}
            >
              학급/팀별
            </Button>
            <Button
              type="button"
              variant={activeTab === 'individual' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs font-bold px-3 rounded-md"
              onClick={() => setActiveTab('individual')}
            >
              개별 학생
            </Button>
          </div>

          {/* 2. 우측: 필터 및 액션 버튼들 (학급/팀별 탭일 때 노출) */}
          {activeTab === 'batch' && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 ml-auto">
              <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedClassNum('all'); setSelectedGroupId(''); }}>
                <SelectTrigger className="w-[68px] sm:w-[85px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold bg-background shadow-2xs"><SelectValue placeholder="학년" /></SelectTrigger>
                <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}>
                <SelectTrigger className="w-[58px] sm:w-[75px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold bg-background shadow-2xs"><SelectValue placeholder="반" /></SelectTrigger>
                <SelectContent><SelectItem value="all">전체</SelectItem>{classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent>
              </Select>
              <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}>
                <SelectTrigger className="w-[95px] sm:w-[120px] h-7 sm:h-8 text-[11px] sm:text-xs font-semibold bg-background shadow-2xs"><SelectValue placeholder="그룹 선택" /></SelectTrigger>
                <SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-7 sm:h-8 px-2 text-[11px] sm:text-xs justify-start w-[85px] sm:w-[105px] font-semibold bg-background shadow-2xs">
                    <CalendarIcon className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                    {batchRecordDate ? format(batchRecordDate, "MM/dd") : "날짜"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus /></PopoverContent>
              </Popover>
              <Select value={batchRecordItem} onValueChange={v => { setBatchRecordItem(v); setShowVideo(false); setShowGradeTable(false); }}>
                <SelectTrigger className="w-[115px] sm:w-[145px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold bg-background shadow-2xs"><SelectValue /></SelectTrigger>
                <SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent>
              </Select>

              {/* 모바일 전용 토글 버튼 */}
              <div className="flex lg:hidden items-center gap-1">
                {selectedItemForBatch?.videoUrl && (
                  <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)} className="h-7 sm:h-8 px-2 text-[11px]">
                    <Youtube className="mr-1 h-3 w-3 text-red-600" />
                    {showVideo ? '영상 닫기' : '영상'}
                  </Button>
                )}
                {selectedItemForBatch?.isPaps && (
                  <Button variant="outline" size="sm" onClick={() => setShowGradeTable(!showGradeTable)} className="h-7 sm:h-8 px-2 text-[11px]">
                    <ClipboardList className="mr-1 h-3 w-3 text-primary" />
                    {showGradeTable ? '기준표 닫기' : '기준표'}
                  </Button>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={studentsForBatch.length === 0} title="엑셀 템플릿 다운로드" className="h-7 sm:h-8 px-2 bg-background shadow-2xs">
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={handleSaveBatchRecords} disabled={isBatchSubmitting || studentsForBatch.length === 0} className="font-bold h-7 sm:h-8 text-xs px-3 shadow-2xs">
                {isBatchSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}전체 저장
              </Button>
            </div>
          )}
        </div>

        {activeTab === 'batch' && (
          <div className="animate-in fade-in-50 duration-200">
            <Card className="bg-transparent shadow-none border-none w-full max-w-full">
              <CardContent className="px-0 sm:px-6 py-1 sm:py-3 space-y-3">
                    {/* 모바일 화면에서 열리는 접이식 영상 및 기준표 */}
                    {showVideo && selectedItemForBatch?.videoUrl && (
                        <div className="lg:hidden aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden border bg-black animate-in fade-in zoom-in-95 mb-2">
                            <iframe width="100%" height="100%" src={getYouTubeEmbedUrl(selectedItemForBatch.videoUrl)!} title="참고 영상" frameBorder="0" allowFullScreen></iframe>
                        </div>
                    )}
                    {showGradeTable && selectedItemForBatch?.isPaps && (
                        <div className="lg:hidden overflow-x-auto rounded-md border bg-muted/30 p-2 animate-in fade-in zoom-in-95 mb-2">
                            {isBmiBatchItem ? (
                              renderBmiStandardsView(false)
                            ) : (
                              <>
                                <p className="text-xs font-bold mb-2 px-1 text-primary">{batchRecordItem} 등급 기준 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)</p>
                                <Table>
                                    <TableHeader><TableRow className="bg-background"><TableHead className="text-center h-7 text-[10px] p-1 w-[60px]">성별</TableHead><TableHead className="text-center h-7 text-[10px] p-1">1등급</TableHead><TableHead className="text-center h-7 text-[10px] p-1">2등급</TableHead><TableHead className="text-center h-7 text-[10px] p-1">3등급</TableHead><TableHead className="text-center h-7 text-[10px] p-1">4등급</TableHead><TableHead className="text-center h-7 text-[10px] p-1">5등급</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        <TableRow className="bg-background"><TableCell className="text-center font-bold text-[10px]">남학생</TableCell>{renderGradeRanges('male')}</TableRow>
                                        <TableRow className="bg-background"><TableCell className="text-center font-bold text-[10px]">여학생</TableCell>{renderGradeRanges('female')}</TableRow>
                                    </TableBody>
                                </Table>
                              </>
                            )}
                        </div>
                    )}

                    {/* 데스크톱/대화면: 좌측 컴팩트 테이블 + 우측 초대형 가이드 패널(스크롤 고정) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 xl:gap-6 items-start">
                        {/* 좌측: 학생 정보 옆의 여백을 절반으로 줄인 컴팩트 측정 테이블 (스크롤 시 헤더 고정) */}
                        <div className="lg:col-span-5 xl:col-span-5 border rounded-lg overflow-hidden bg-card shadow-sm max-h-[calc(100vh-200px)] overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b shadow-sm">
                                    <TableRow className="h-9 bg-muted/40">
                                        <TableHead className="w-14 sm:w-16 text-center p-1 text-[11px] sm:text-xs font-bold">사진</TableHead>
                                        <TableHead className="w-[110px] sm:w-[125px] p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">학생 정보</TableHead>
                                        <TableHead className="w-16 sm:w-20 text-center p-1 text-blue-600 font-bold text-[11px] sm:text-xs whitespace-nowrap">이전 기록</TableHead>
                                        {selectedItemForBatch?.isCompound ? (
                                            <>
                                                <TableHead className="w-14 sm:w-16 text-center p-1 text-[11px] sm:text-xs">키(cm)</TableHead>
                                                <TableHead className="w-14 sm:w-16 text-center p-1 text-[11px] sm:text-xs">몸무게(kg)</TableHead>
                                                <TableHead className="w-16 sm:w-20 text-center p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">BMI</TableHead>
                                            </>
                                        ) : (
                                            <TableHead className="w-20 sm:w-24 text-center p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">
                                                현재 기록{selectedItemForBatch?.unit ? `(${selectedItemForBatch.unit})` : ''}
                                            </TableHead>
                                        )}
                                        <TableHead className="w-12 sm:w-16 text-center p-1 text-[11px] sm:text-xs font-bold">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsForBatch.map(s => {
                                        const prev = getPreviousRecord(s.id, batchRecordItem);
                                        const current = batchRecords[s.id] || {};
                                        const isSaved = savedIds.has(s.id);
                                        return (
                                            <TableRow key={s.id} className={cn(isSaved && "bg-green-50/50 dark:bg-green-950/20 transition-colors", "h-14 sm:h-16 hover:bg-muted/40")}>
                                                <TableCell className="p-1 text-center">
                                                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-lg shadow-sm border border-border/50">
                                                        <AvatarImage src={s.photoUrl} className="object-cover" />
                                                        <AvatarFallback className="text-xs font-bold bg-muted">{s.name[0]}</AvatarFallback>
                                                    </Avatar>
                                                </TableCell>
                                                <TableCell className="p-1 whitespace-nowrap">
                                                    <div className="flex flex-col justify-center">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-bold text-xs sm:text-sm leading-tight whitespace-nowrap">{s.name}</span>
                                                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-3.5", s.gender === '남' ? 'text-blue-600 border-blue-200' : 'text-pink-600 border-pink-200')}>
                                                                {s.gender}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-tight mt-0.5">
                                                            {s.grade}-{s.classNum} {s.studentNum}번
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1 text-center text-xs sm:text-sm font-black text-blue-600 whitespace-nowrap">
                                                    {prev ? (
                                                        <div className="flex flex-col items-center leading-tight">
                                                            <span>{prev.value}{selectedItemForBatch?.unit || ''}</span>
                                                            <span className="text-[9px] font-normal text-muted-foreground">{prev.date?.slice(5)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground font-normal">-</span>
                                                    )}
                                                </TableCell>
                                                {selectedItemForBatch?.isCompound ? (
                                                    <>
                                                        <TableCell className="p-1"><Input type="number" placeholder="키" value={current.height || ''} onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, height: e.target.value}})} className="text-center h-8 text-xs px-1" /></TableCell>
                                                        <TableCell className="p-1"><Input type="number" placeholder="몸무게" value={current.weight || ''} onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, weight: e.target.value}})} className="text-center h-8 text-xs px-1" /></TableCell>
                                                        <TableCell className="p-1 text-center font-bold text-xs">
                                                            {(() => {
                                                                const bmiStr = calculateBmi(current.height, current.weight);
                                                                if (!bmiStr) return <span className="text-muted-foreground font-normal">-</span>;
                                                                const bmiVal = parseFloat(bmiStr);
                                                                const grade = getBmiGrade(s.grade, s.gender, bmiVal);
                                                                const status = getBmiStatusText(s.grade, s.gender, bmiVal);
                                                                
                                                                const badgeColor = 
                                                                    grade === 1 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300" :
                                                                    grade === 2 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300" :
                                                                    grade === 3 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300" :
                                                                    grade === 4 ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300" :
                                                                    "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300";

                                                                return (
                                                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                                                        <span className="text-xs font-black text-foreground">{bmiStr}</span>
                                                                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 font-bold border whitespace-nowrap", badgeColor)}>
                                                                            {status} ({grade}등급)
                                                                        </Badge>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <TableCell className="p-1 text-center">
                                                        <Input 
                                                            type="number" 
                                                            className="text-center w-full max-w-[75px] sm:max-w-[90px] mx-auto h-8 sm:h-9 text-xs sm:text-sm px-1 font-bold shadow-inner" 
                                                            placeholder="0.0"
                                                            value={current.value || ''} 
                                                            onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, value: e.target.value}})} 
                                                            onKeyDown={e => e.key === 'Enter' && handleIndividualSave(s.id)}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell className="p-1 text-center">
                                                    <Button 
                                                        variant={isSaved ? "ghost" : "outline"} 
                                                        size="sm" 
                                                        onClick={() => handleIndividualSave(s.id)} 
                                                        disabled={savingId === s.id} 
                                                        className={cn("h-7 sm:h-8 px-1.5 sm:px-2 mx-auto transition-all", isSaved ? "text-green-600 font-bold bg-green-50/50" : "font-semibold")}
                                                    >
                                                        {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <CheckCircle2 className="h-3.5 w-3.5 sm:mr-1" /> : <Save className="h-3.5 w-3.5 sm:mr-1" />}
                                                        <span className="hidden sm:inline text-xs">{isSaved ? '저장됨' : '저장'}</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!studentsForBatch.length && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-28 text-center text-xs sm:text-sm text-muted-foreground">
                                                상단 필터에서 학년/반 또는 팀 그룹을 선택하면 학생 명단이 표시됩니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* 우측: 기준표와 영상을 가로로 나란히 배치하여 영상 하단 잘림이 전혀 없는 최적화 패널 */}
                        {(() => {
                            const currentVideoUrl = selectedItemForBatch?.videoUrl || (batchRecordItem === '왕복오래달리기' ? 'https://www.youtube.com/watch?v=kY6T6o9_O6Q' : undefined);
                            return (
                                <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 flex-col gap-2.5 sticky top-4 self-start max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
                                    {/* 1. 슬림해진 학급 측정 진행 현황 카드 */}
                                    <Card className="border bg-card/70 backdrop-blur-sm shadow-sm">
                                        <CardHeader className="p-2.5 pb-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs sm:text-sm font-bold text-foreground">학급 측정 진행 현황</span>
                                                <span className="text-xs sm:text-sm font-black text-primary">{batchStats.completed} / {batchStats.total}명 ({batchStats.percentage}%)</span>
                                            </div>
                                            <Progress value={batchStats.percentage} className="h-2 mt-1.5 rounded-full" />
                                        </CardHeader>
                                        <CardContent className="p-2.5 pt-0 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t pt-1.5 mt-1">
                                            <div className="flex items-center gap-3">
                                                <span>종목: <strong className="text-foreground font-bold">{batchRecordItem || '선택 안 됨'}</strong></span>
                                                <span>일자: <strong className="text-foreground font-bold">{batchRecordDate ? format(batchRecordDate, 'yyyy-MM-dd') : '-'}</strong></span>
                                            </div>

                                            {/* 뷰 모드 전환 버튼 */}
                                            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg">
                                                <Button 
                                                    variant={guideTab === 'side' ? 'default' : 'ghost'} 
                                                    size="sm" 
                                                    className="h-6 text-[11px] px-2 font-bold"
                                                    onClick={() => setGuideTab('side')}
                                                >
                                                    나란히 보기
                                                </Button>
                                                <Button 
                                                    variant={guideTab === 'standards' ? 'default' : 'ghost'} 
                                                    size="sm" 
                                                    className="h-6 text-[11px] px-2 font-bold"
                                                    onClick={() => setGuideTab('standards')}
                                                >
                                                    기준표만
                                                </Button>
                                                <Button 
                                                    variant={guideTab === 'video' ? 'default' : 'ghost'} 
                                                    size="sm" 
                                                    className="h-6 text-[11px] px-2 font-bold"
                                                    disabled={!currentVideoUrl}
                                                    onClick={() => setGuideTab('video')}
                                                >
                                                    영상만
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* 2. 나란히 보기 모드: 화면이 작더라도 무조건 가로로 나란히(flex-row) 배치하여 영상 하단 잘림 원천 해결! */}
                                    {guideTab === 'side' && (
                                        <div className="flex flex-row gap-2 items-stretch w-full">
                                            {/* 좌측: 가로폭을 확 줄인 콤팩트 기준표 */}
                                            {selectedItemForBatch?.isPaps && (
                                                <div className={cn(currentVideoUrl ? "w-[46%] min-w-0" : "w-full", "flex flex-col")}>
                                                    <Card className="border bg-card/70 backdrop-blur-sm shadow-sm h-full flex flex-col justify-between">
                                                        <CardHeader className="p-2 pb-1">
                                                            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-primary truncate">
                                                                <ClipboardList className="h-3.5 w-3.5 flex-shrink-0" />
                                                                <span className="truncate">{batchRecordItem} 기준표 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)</span>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="p-1.5 pt-0 flex-1 flex flex-col justify-center">
                                                            {isBmiBatchItem ? (
                                                                renderBmiStandardsView(false)
                                                            ) : (
                                                                <div className="rounded-md border bg-background/90 overflow-hidden shadow-inner">
                                                                    <Table className="w-full table-fixed">
                                                                        <TableHeader>
                                                                            <TableRow className="bg-muted/50 h-6">
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 w-[28px] font-bold">성별</TableHead>
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 font-bold text-primary">1등급</TableHead>
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 font-bold text-primary">2등급</TableHead>
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 font-bold text-primary">3등급</TableHead>
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 font-bold text-primary">4등급</TableHead>
                                                                                <TableHead className="text-center h-6 text-[9px] sm:text-[10px] p-0.5 font-bold text-primary">5등급</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            <TableRow className="h-6 hover:bg-muted/30">
                                                                                <TableCell className="text-center font-black text-[9px] sm:text-[10px] p-0.5 text-blue-600 bg-muted/20">남</TableCell>
                                                                                {renderGradeRanges('male', false)}
                                                                            </TableRow>
                                                                            <TableRow className="h-6 hover:bg-muted/30">
                                                                                <TableCell className="text-center font-black text-[9px] sm:text-[10px] p-0.5 text-pink-600 bg-muted/20">여</TableCell>
                                                                                {renderGradeRanges('female', false)}
                                                                            </TableRow>
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}

                                            {/* 우측: 기준표 옆에 나란히 들어가는 16:9 측정 예시 영상 (하단 잘림 0%) */}
                                            {currentVideoUrl && (
                                                <div className={cn(selectedItemForBatch?.isPaps ? "w-[54%] min-w-0" : "w-full", "flex flex-col")}>
                                                    <Card className="border bg-card/70 backdrop-blur-sm shadow-sm overflow-hidden h-full flex flex-col justify-between">
                                                        <CardHeader className="p-2 pb-1">
                                                            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-600 truncate">
                                                                <Youtube className="h-3.5 w-3.5 flex-shrink-0" />
                                                                <span className="truncate">{batchRecordItem} 측정 예시 영상</span>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="p-1.5 pt-0 flex-1 flex items-center">
                                                            <div className="aspect-video w-full rounded-md overflow-hidden border bg-black shadow-md">
                                                                <iframe width="100%" height="100%" src={getYouTubeEmbedUrl(currentVideoUrl)!} title="참고 영상" frameBorder="0" allowFullScreen></iframe>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 3. 기준표만 단독 크게 보기 모드 */}
                                    {guideTab === 'standards' && selectedItemForBatch?.isPaps && (
                                        <Card className="border bg-card/70 backdrop-blur-sm shadow-sm animate-in fade-in-50 duration-200">
                                            <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary">
                                                    <ClipboardList className="h-4 w-4" />
                                                    <span>{batchRecordItem} 등급 기준표 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)</span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-3 pt-0">
                                                {isBmiBatchItem ? (
                                                    renderBmiStandardsView(true)
                                                ) : (
                                                    <div className="rounded-lg border bg-background/90 overflow-hidden shadow-inner">
                                                        <Table className="w-full">
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50 h-8">
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 w-[65px] font-bold">성별</TableHead>
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 font-bold text-primary">1등급</TableHead>
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 font-bold text-primary">2등급</TableHead>
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 font-bold text-primary">3등급</TableHead>
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 font-bold text-primary">4등급</TableHead>
                                                                    <TableHead className="text-center h-8 text-xs sm:text-sm p-1.5 font-bold text-primary">5등급</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                <TableRow className="h-9 hover:bg-muted/30">
                                                                    <TableCell className="text-center font-black text-xs sm:text-sm p-1.5 text-blue-600 bg-muted/20">남학생</TableCell>
                                                                    {renderGradeRanges('male', true)}
                                                                </TableRow>
                                                                <TableRow className="h-9 hover:bg-muted/30">
                                                                    <TableCell className="text-center font-black text-xs sm:text-sm p-1.5 text-pink-600 bg-muted/20">여학생</TableCell>
                                                                    {renderGradeRanges('female', true)}
                                                                </TableRow>
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* 4. 영상만 단독 크게 보기 모드 */}
                                    {guideTab === 'video' && currentVideoUrl && (
                                        <Card className="border bg-card/70 backdrop-blur-sm shadow-sm overflow-hidden animate-in fade-in-50 duration-200">
                                            <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-red-600">
                                                    <Youtube className="h-4 w-4" />
                                                    <span>{batchRecordItem} 측정 예시 및 유의사항 영상</span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-3 pt-0">
                                                <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black shadow-lg">
                                                    <iframe width="100%" height="100%" src={getYouTubeEmbedUrl(currentVideoUrl)!} title="참고 영상" frameBorder="0" allowFullScreen></iframe>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'individual' && (
          <div className="animate-in fade-in-50 duration-200">
             <Card className="bg-transparent shadow-none border-none max-w-5xl mx-auto">
                <CardHeader className="px-0 sm:px-6 py-1 sm:py-3">
                    <CardTitle className="text-base sm:text-xl font-bold truncate">개별 학생 기록 입력</CardTitle>
                    <CardDescription className="text-[11px] sm:text-xs text-muted-foreground truncate">학생의 이름을 검색하여 특정 종목의 기록을 입력합니다.</CardDescription>
                    <div className="flex items-center gap-2 pt-2 max-w-md">
                        <Input placeholder="학생 이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="h-8 text-xs" />
                        <Button size="sm" onClick={handleSearch} className="h-8 px-3 text-xs"><Search className="mr-1.5 h-3.5 w-3.5" /> 검색</Button>
                    </div>
                </CardHeader>
                {selectedStudent ? (
                    <CardContent className="px-0 sm:px-6 py-1 sm:py-3 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                            {/* 좌측: 학생 정보 & 기록 입력 폼 */}
                            <div className="md:col-span-7 space-y-3 bg-card p-4 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                                    <Avatar className="w-14 h-14 border-2 border-background shadow-sm">
                                        <AvatarImage src={selectedStudent.photoUrl} className="object-cover" />
                                        <AvatarFallback className="font-bold text-sm bg-muted">{selectedStudent.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-lg text-primary">{selectedStudent.name}</p>
                                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 font-bold", selectedStudent.gender === '남' ? 'text-blue-600 border-blue-200' : 'text-pink-600 border-pink-200')}>
                                                {selectedStudent.gender}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{selectedStudent.grade}학년 {selectedStudent.classNum}반 {selectedStudent.studentNum}번</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => setSelectedStudent(null)}><X className="h-3.5 w-3.5 mr-1" /> 변경</Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className="w-full h-8 text-xs justify-start">
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5 flex-shrink-0" />
                                                {recordDate ? format(recordDate, "yyyy-MM-dd") : "날짜 선택"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={recordDate} onSelect={setRecordDate} initialFocus /></PopoverContent>
                                    </Popover>
                                    <Select value={selectedItemName} onValueChange={v => { setSelectedItemName(v); setShowVideo(false); setShowGradeTable(false); }}>
                                        <SelectTrigger className="h-8 text-xs font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                
                                {selectedItemForSingle?.isCompound ? (
                                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg border border-dashed">
                                        <div className="space-y-1"><Label className="text-xs">키 (cm)</Label><Input type="number" placeholder="예: 145.2" value={batchRecords[selectedStudent.id]?.height || ''} onChange={e => setBatchRecords({...batchRecords, [selectedStudent.id]: {...batchRecords[selectedStudent.id], height: e.target.value}})} className="h-9 text-sm" /></div>
                                        <div className="space-y-1"><Label className="text-xs">몸무게 (kg)</Label><Input type="number" placeholder="예: 38.5" value={batchRecords[selectedStudent.id]?.weight || ''} onChange={e => setBatchRecords({...batchRecords, [selectedStudent.id]: {...batchRecords[selectedStudent.id], weight: e.target.value}})} className="h-9 text-sm" /></div>
                                        <div className="col-span-2 text-center pt-2 border-t flex flex-col items-center justify-center gap-1">
                                            <div className="flex items-center justify-center gap-2">
                                                <span className="text-xs font-bold text-muted-foreground">자동 계산된 BMI: </span>
                                                <span className="text-xl font-black text-primary">{calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight) || '-'}</span>
                                            </div>
                                            {(() => {
                                                const bmiStr = calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight);
                                                if (!bmiStr) return null;
                                                const bmiVal = parseFloat(bmiStr);
                                                const grade = getBmiGrade(selectedStudent.grade, selectedStudent.gender, bmiVal);
                                                const status = getBmiStatusText(selectedStudent.grade, selectedStudent.gender, bmiVal);
                                                const badgeColor = 
                                                    grade === 1 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300" :
                                                    grade === 2 ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300" :
                                                    grade === 3 ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300" :
                                                    grade === 4 ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300" :
                                                    "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300";

                                                return (
                                                    <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5 font-bold border", badgeColor)}>
                                                        {status} ({grade}등급)
                                                    </Badge>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">측정 기록 입력 ({selectedItemForSingle?.unit || ''})</Label>
                                        <Input 
                                            type="number" 
                                            value={recordValue} 
                                            onChange={e => setRecordValue(e.target.value)} 
                                            className="text-2xl h-14 font-black text-center shadow-inner" 
                                            placeholder="0.0" 
                                        />
                                    </div>
                                )}

                                <Button className="w-full h-11 text-base font-bold shadow-md transition-all active:scale-[0.99] mt-2" onClick={async () => {
                                    if (!school || !selectedStudent || !selectedItemName || !recordDate) return;
                                    let val = selectedItemForSingle?.isCompound ? parseFloat(calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight)) : parseFloat(recordValue);
                                    if (isNaN(val)) {
                                        toast({ variant: 'destructive', title: '기록을 올바르게 입력해주세요.' });
                                        return;
                                    }

                                    const targetDateStr = format(recordDate, 'yyyy-MM-dd');
                                    const existing = allRecords.find(r => r.studentId === selectedStudent.id && r.item === selectedItemName && r.date === targetDateStr);
                                    const existingId = existing?.id;

                                    const optimisticRecord: MeasurementRecord = {
                                        id: existingId || `temp_${selectedStudent.id}_${Date.now()}`,
                                        studentId: selectedStudent.id,
                                        school,
                                        item: selectedItemName,
                                        date: targetDateStr,
                                        value: val,
                                        height: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.height || '') : undefined,
                                        weight: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.weight || '') : undefined
                                    };

                                    onRecordUpdate([optimisticRecord], 'update');
                                    toast({ title: "기록 저장 완료" });
                                    setRecordValue('');

                                    addOrUpdateRecord({ 
                                        id: existingId,
                                        studentId: selectedStudent.id, 
                                        school, 
                                        item: selectedItemName, 
                                        date: targetDateStr, 
                                        value: val,
                                        height: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.height || '') : undefined,
                                        weight: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.weight || '') : undefined
                                    }).then(savedRec => {
                                        onRecordUpdate([savedRec], 'update');
                                    }).catch(e => {
                                        console.error("[개별기록저장] 백그라운드 저장 실패:", e);
                                        toast({ variant: 'destructive', title: '저장 실패', description: '서버 저장 중 오류가 발생했습니다.' });
                                    });
                                }} disabled={isSubmitting || (!recordValue && !selectedItemForSingle?.isCompound)}>
                                    <Save className="mr-2 h-4 w-4" />
                                    기록 저장하기
                                </Button>
                            </div>

                            {/* 우측: 해당 종목 등급 기준표 및 최근 기록 히스토리 */}
                            <div className="md:col-span-5 space-y-3">
                                {selectedItemForSingle?.isPaps && (
                                    <Card className="border bg-card shadow-sm">
                                        <CardHeader className="p-3 pb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                                <ClipboardList className="h-4 w-4" />
                                                <span>{selectedItemName} 등급 기준표 ({selectedStudent.grade}학년)</span>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0">
                                            <div className="rounded-md border overflow-hidden">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/40 h-7">
                                                            <TableHead className="text-center h-7 text-[10px] p-1 w-[55px] font-bold">성별</TableHead>
                                                            <TableHead className="text-center h-7 text-[10px] p-1">1등급</TableHead>
                                                            <TableHead className="text-center h-7 text-[10px] p-1">2등급</TableHead>
                                                            <TableHead className="text-center h-7 text-[10px] p-1">3등급</TableHead>
                                                            <TableHead className="text-center h-7 text-[10px] p-1">4등급</TableHead>
                                                            <TableHead className="text-center h-7 text-[10px] p-1">5등급</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        <TableRow className="h-7"><TableCell className="text-center font-bold text-[10px] p-1">남학생</TableCell>{renderGradeRanges('male')}</TableRow>
                                                        <TableRow className="h-7"><TableCell className="text-center font-bold text-[10px] p-1">여학생</TableCell>{renderGradeRanges('female')}</TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* 이전 측정 기록 카드 */}
                                <Card className="border bg-card shadow-sm">
                                    <CardHeader className="p-3 pb-2">
                                        <span className="text-xs font-bold text-foreground">해당 학생 최근 측정 이력 ({selectedItemName})</span>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-0">
                                        {allRecords.filter(r => r.studentId === selectedStudent.id && r.item === selectedItemName).length > 0 ? (
                                            <div className="space-y-1.5">
                                                {allRecords.filter(r => r.studentId === selectedStudent.id && r.item === selectedItemName).slice(-3).reverse().map((r, i) => (
                                                    <div key={r.id || i} className="flex justify-between items-center text-xs p-2 rounded bg-muted/40 border">
                                                        <span className="text-muted-foreground">{r.date}</span>
                                                        <span className="font-bold text-primary">{r.value}{selectedItemForSingle?.unit || ''}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-muted-foreground py-2 text-center">이전에 저장된 기록이 없습니다.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </CardContent>
                ) : (
                    <CardContent className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-2xl mt-3">
                        학생의 이름을 검색하여 선택해주세요.
                    </CardContent>
                )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
