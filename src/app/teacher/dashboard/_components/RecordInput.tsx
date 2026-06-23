
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
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/paps';

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
  
  const activeItems = useMemo(() => allItems.filter(item => item.isMeasurementWeek && !item.isArchived && !item.isDeactivated), [allItems]);
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

  const selectedItemForBatch = useMemo(() => activeItems.find(item => item.name === batchRecordItem), [batchRecordItem, activeItems]);
  const selectedItemForSingle = useMemo(() => activeItems.find(item => item.name === selectedItemName), [selectedItemName, activeItems]);

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

    setSavingId(studentId);
    try {
      const rec = await addOrUpdateRecord({ 
        studentId, 
        school, 
        item: batchRecordItem, 
        date: format(batchRecordDate, 'yyyy-MM-dd'), 
        value: valueToSave,
        height: input.height ? parseFloat(input.height) : undefined,
        weight: input.weight ? parseFloat(input.weight) : undefined
      });
      onRecordUpdate([rec], 'update');
      setSavedIds(prev => new Set(prev).add(studentId));
      toast({ title: "저장 완료" });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setSavingId(null);
    }
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

  const renderGradeRanges = (gender: 'male' | 'female') => {
    const gradeToUse = selectedGrade || (studentsForBatch[0]?.grade || '5');
    const itemKey = batchRecordItem === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : batchRecordItem;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    if (!itemStandards) return <TableCell colSpan={5} className="text-center text-muted-foreground text-[10px]">데이터 없음</TableCell>;
    const ranges = itemStandards[gender];
    const unit = selectedItemForBatch?.unit || '';
    return [1, 2, 3, 4, 5].map(g => {
        const r = ranges.find(range => range.grade === g);
        if (!r) return <TableCell key={g} className="text-center text-[10px]">-</TableCell>;
        const text = r.max === Infinity ? `${r.min}${unit}↑` : (r.min === -Infinity || r.min === 0) ? `${r.max}${unit}↓` : `${r.min}~${r.max}${unit}`;
        return <TableCell key={g} className="text-center text-[10px] break-keep">{text}</TableCell>;
    });
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="batch">학급/팀별 기록</TabsTrigger>
            <TabsTrigger value="individual">개별 기록</TabsTrigger>
        </TabsList>
        
        <TabsContent value="batch" className="animate-in fade-in-50 duration-300">
             <Card className="bg-transparent shadow-none border-none">
                <CardHeader>
                    <CardTitle>학급/팀별 측정 기록</CardTitle>
                    <CardDescription>아이들의 이전 기록을 참고하며 한 명씩 실시간으로 안전하게 저장하세요.</CardDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-4">
                        <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedClassNum('all'); setSelectedGroupId(''); }}><SelectTrigger className="w-[100px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
                        <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}><SelectTrigger className="w-[100px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
                        <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="그룹 선택" /></SelectTrigger><SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent></Select>
                        <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[180px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{batchRecordDate ? format(batchRecordDate, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={batchRecordDate} onSelect={setBatchRecordDate} initialFocus /></PopoverContent></Popover>
                        <Select value={batchRecordItem} onValueChange={v => { setBatchRecordItem(v); setShowVideo(false); setShowGradeTable(false); }}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
                        <Button variant="outline" onClick={handleDownloadTemplate} disabled={studentsForBatch.length === 0} title="엑셀 템플릿 다운로드">
                            <Download className="mr-2 h-4 w-4" />
                            템플릿
                        </Button>
                        <Button onClick={handleSaveBatchRecords} disabled={isBatchSubmitting || studentsForBatch.length === 0} className="ml-auto font-bold">{isBatchSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}전체 저장</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {selectedItemForBatch && (
                        <div className="flex flex-wrap gap-2">
                            {selectedItemForBatch.videoUrl && (
                                <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)}>
                                    <Youtube className="mr-2 h-4 w-4 text-red-600" />
                                    {showVideo ? '영상 닫기' : '측정 예시 영상'}
                                </Button>
                            )}
                            {selectedItemForBatch.isPaps && (
                                <Button variant="outline" size="sm" onClick={() => setShowGradeTable(!showGradeTable)}>
                                    <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                                    {showGradeTable ? '기준표 닫기' : '등급 기준표'}
                                </Button>
                            )}
                        </div>
                    )}

                    {showVideo && selectedItemForBatch?.videoUrl && (
                        <div className="aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden border bg-black animate-in fade-in zoom-in-95">
                            <iframe width="100%" height="100%" src={getYouTubeEmbedUrl(selectedItemForBatch.videoUrl)!} title="참고 영상" frameBorder="0" allowFullScreen></iframe>
                        </div>
                    )}

                    {showGradeTable && selectedItemForBatch?.isPaps && (
                        <div className="overflow-x-auto rounded-md border bg-muted/30 p-2 animate-in fade-in zoom-in-95">
                            <p className="text-xs font-bold mb-2 px-1 text-primary">{batchRecordItem} 등급 기준 ({selectedGrade || studentsForBatch[0]?.grade || '5'}학년)</p>
                            <Table>
                                <TableHeader><TableRow className="bg-background"><TableHead className="text-center h-8 text-[10px] p-1 w-[80px]">성별</TableHead><TableHead className="text-center h-8 text-[10px] p-1">1등급</TableHead><TableHead className="text-center h-8 text-[10px] p-1">2등급</TableHead><TableHead className="text-center h-8 text-[10px] p-1">3등급</TableHead><TableHead className="text-center h-8 text-[10px] p-1">4등급</TableHead><TableHead className="text-center h-8 text-[10px] p-1">5등급</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    <TableRow className="bg-background"><TableCell className="text-center font-bold text-[10px]">남학생</TableCell>{renderGradeRanges('male')}</TableRow>
                                    <TableRow className="bg-background"><TableCell className="text-center font-bold text-[10px]">여학생</TableCell>{renderGradeRanges('female')}</TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">사진</TableHead>
                                    <TableHead className="w-32">이름</TableHead>
                                    <TableHead className="w-24 text-blue-600 font-bold">이전 기록</TableHead>
                                    {selectedItemForBatch?.isCompound ? (
                                        <>
                                            <TableHead className="w-24 text-center">키(cm)</TableHead>
                                            <TableHead className="w-24 text-center">몸무게(kg)</TableHead>
                                            <TableHead className="w-20 text-center">BMI</TableHead>
                                        </>
                                    ) : (
                                        <TableHead className="text-center">현재 기록({selectedItemForBatch?.unit})</TableHead>
                                    )}
                                    <TableHead className="w-24 text-right">작업</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {studentsForBatch.map(s => {
                                    const prev = getPreviousRecord(s.id, batchRecordItem);
                                    const current = batchRecords[s.id] || {};
                                    const isSaved = savedIds.has(s.id);
                                    return (
                                        <TableRow key={s.id} className={cn(isSaved && "bg-green-50/50 transition-colors")}>
                                            <TableCell><Avatar className="w-10 h-10"><AvatarImage src={s.photoUrl} /><AvatarFallback>{s.name[0]}</AvatarFallback></Avatar></TableCell>
                                            <TableCell><div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.grade}-{s.classNum} {s.studentNum}번</span></div></TableCell>
                                            <TableCell className="text-xs font-black text-blue-600 italic">{prev ? `${prev.value}${selectedItemForBatch?.unit || ''}` : '-'}</TableCell>
                                            {selectedItemForBatch?.isCompound ? (
                                                <>
                                                    <TableCell><Input type="number" placeholder="키" value={current.height || ''} onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, height: e.target.value}})} className="text-center h-9" /></TableCell>
                                                    <TableCell><Input type="number" placeholder="몸무게" value={current.weight || ''} onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, weight: e.target.value}})} className="text-center h-9" /></TableCell>
                                                    <TableCell className="text-center font-bold text-primary text-sm">{calculateBmi(current.height, current.weight)}</TableCell>
                                                </>
                                            ) : (
                                                <TableCell><Input type="number" className="text-center max-w-[120px] mx-auto h-9" value={current.value || ''} onChange={e => setBatchRecords({...batchRecords, [s.id]: {...current, value: e.target.value}})} /></TableCell>
                                            )}
                                            <TableCell className="text-right">
                                                <Button variant={isSaved ? "ghost" : "outline"} size="sm" onClick={() => handleIndividualSave(s.id)} disabled={savingId === s.id} className={cn("h-8 px-2 transition-all", isSaved && "text-green-600 font-bold")}>
                                                    {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                                    <span className="ml-1 hidden sm:inline">{isSaved ? '저장됨' : '저장'}</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!studentsForBatch.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">상단 필터를 통해 학급 또는 팀을 선택해주세요.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="individual" className="animate-in fade-in-50 duration-300">
             <Card className="bg-transparent shadow-none border-none">
                <CardHeader>
                    <CardTitle>개별 학생 기록 입력</CardTitle>
                    <CardDescription>학생의 이름을 검색하여 특정 종목의 기록을 입력합니다.</CardDescription>
                    <div className="flex gap-2 pt-4">
                        <Input placeholder="이름 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full sm:w-auto" />
                        <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" /> 검색</Button>
                    </div>
                </CardHeader>
                {selectedStudent ? (
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg border border-primary/10">
                            <Avatar className="w-20 h-20 border-2 border-background"><AvatarImage src={selectedStudent.photoUrl} /><AvatarFallback>{selectedStudent.name[0]}</AvatarFallback></Avatar>
                            <div><p className="font-black text-xl text-primary">{selectedStudent.name}</p><p className="text-sm font-medium text-muted-foreground">{selectedStudent.grade}학년 {selectedStudent.classNum}반 ({selectedStudent.gender})</p></div>
                            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedStudent(null)}><X className="h-4 w-4" /> 변경</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{recordDate ? format(recordDate, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={recordDate} onSelect={setRecordDate} initialFocus /></PopoverContent></Popover>
                            <Select value={selectedItemName} onValueChange={v => { setSelectedItemName(v); setShowVideo(false); setShowGradeTable(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        
                        {selectedItemForSingle?.isCompound ? (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-dashed">
                                <div className="space-y-2"><Label>키 (cm)</Label><Input type="number" value={batchRecords[selectedStudent.id]?.height || ''} onChange={e => setBatchRecords({...batchRecords, [selectedStudent.id]: {...batchRecords[selectedStudent.id], height: e.target.value}})} className="text-lg h-12" /></div>
                                <div className="space-y-2"><Label>몸무게 (kg)</Label><Input type="number" value={batchRecords[selectedStudent.id]?.weight || ''} onChange={e => setBatchRecords({...batchRecords, [selectedStudent.id]: {...batchRecords[selectedStudent.id], weight: e.target.value}})} className="text-lg h-12" /></div>
                                <div className="col-span-2 text-center pt-2">
                                    <span className="text-sm font-bold text-muted-foreground">자동 계산된 BMI: </span>
                                    <span className="text-2xl font-black text-primary">{calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2"><Label>기록 입력 ({selectedItemForSingle?.unit})</Label><Input type="number" value={recordValue} onChange={e => setRecordValue(e.target.value)} className="text-2xl py-8 font-black text-center" placeholder="0.0" /></div>
                        )}
                        <Button className="w-full py-8 text-xl font-black shadow-xl transition-all active:scale-[0.98]" onClick={async () => {
                            if (!school || !selectedStudent || !selectedItemName || !recordDate) return;
                            setIsSubmitting(true);
                            try {
                                let val = selectedItemForSingle?.isCompound ? parseFloat(calculateBmi(batchRecords[selectedStudent.id]?.height, batchRecords[selectedStudent.id]?.weight)) : parseFloat(recordValue);
                                if (isNaN(val)) throw new Error("Invalid value");
                                const rec = await addOrUpdateRecord({ 
                                    studentId: selectedStudent.id, 
                                    school, 
                                    item: selectedItemName, 
                                    date: format(recordDate, 'yyyy-MM-dd'), 
                                    value: val,
                                    height: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.height || '') : undefined,
                                    weight: selectedItemForSingle?.isCompound ? parseFloat(batchRecords[selectedStudent.id]?.weight || '') : undefined
                                });
                                onRecordUpdate([rec], 'update');
                                toast({ title: "기록 저장 완료" });
                                setRecordValue('');
                            } catch(e) { toast({ variant: 'destructive', title: '저장 실패' }); }
                            finally { setIsSubmitting(false); }
                        }} disabled={isSubmitting || (!recordValue && !selectedItemForSingle?.isCompound)}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Save className="mr-2 h-6 w-6" />}
                            기록 저장하기
                        </Button>
                    </CardContent>
                ) : <CardContent className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl mt-4">학생의 이름을 검색하여 선택해주세요.</CardContent>}
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
