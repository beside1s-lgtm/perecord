
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord, addOrUpdateRecords } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord, TeamGroup, SportsClub } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar as CalendarIcon, Youtube, ClipboardList, Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/paps';

export function BatchInput({ allStudents, activeItems, allRecords, onRecordUpdate, allTeamGroups, sportsClubs }: { allStudents: Student[], activeItems: MeasurementItem[], allRecords: MeasurementRecord[], onRecordUpdate: any, allTeamGroups: TeamGroup[], sportsClubs: SportsClub[] }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClassNum, setSelectedClassNum] = useState('all');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [batchItem, setBatchItem] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [records, setBatchRecords] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  
  const [showVideo, setShowVideo] = useState(false);
  const [showGradeTable, setShowGradeTable] = useState(false);

  useEffect(() => { 
    if (activeItems.length && !batchItem) setBatchItem(activeItems[0].name); 
  }, [activeItems, batchItem]);

  useEffect(() => {
    setBatchRecords({});
    setSavedIds(new Set());
  }, [selectedGrade, selectedClassNum, selectedGroupId, batchItem]);

  const students = useMemo(() => {
    let list: Student[] = [];
    if (selectedGroupId) {
      const group = (allTeamGroups as (TeamGroup | SportsClub)[]).concat(sportsClubs).find(g => g.id === selectedGroupId);
      if (group) {
        let ids: string[] = [];
        if ('teams' in group) {
          ids = (group as TeamGroup).teams.flatMap(t => t.memberIds);
        } else if ('memberIds' in group) {
          ids = (group as SportsClub).memberIds;
        }
        list = allStudents.filter(s => ids.includes(s.id));
      }
    } else if (selectedGrade) {
      list = allStudents.filter(s => s.grade === selectedGrade && (selectedClassNum === 'all' || s.classNum === selectedClassNum));
    }
    
    return list.sort((a, b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
      return parseInt(a.studentNum) - parseInt(b.studentNum);
    });
  }, [allStudents, selectedGrade, selectedClassNum, selectedGroupId, allTeamGroups, sportsClubs]);

  const selectedItemInfo = useMemo(() => activeItems.find(i => i.name === batchItem), [batchItem, activeItems]);

  const getPreviousRecord = (studentId: string) => {
    return allRecords
      .filter(r => r.studentId === studentId && r.item === batchItem)
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
    if (!school || !batchItem || !date) return;
    const input = records[studentId];
    if (!input) return;

    let val: number | null = null;
    if (selectedItemInfo?.isCompound) {
        const bmi = calculateBmi(input.height, input.weight);
        val = bmi ? parseFloat(bmi) : null;
    } else {
        val = input.value ? parseFloat(input.value) : null;
    }

    if (val === null || isNaN(val)) return;

    setSavingId(studentId);
    try {
      const rec = await addOrUpdateRecord({ 
        studentId, 
        school, 
        item: batchItem, 
        date: format(date, 'yyyy-MM-dd'), 
        value: val,
        height: selectedItemInfo?.isCompound ? parseFloat(input.height) : undefined,
        weight: selectedItemInfo?.isCompound ? parseFloat(input.weight) : undefined
      });
      onRecordUpdate([rec], 'update');
      setSavedIds(prev => new Set(prev).add(studentId));
      toast({ title: "저장 완료" });
    } catch (e) {
      console.error('[BatchInput] 저장 실패 상세 에러:', e);
      toast({ variant: "destructive", title: "저장 실패", description: (e as any)?.message || '알 수 없는 오류' });
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    if (!school || !batchItem || !date) return;
    setIsSubmitting(true);
    try {
      const toSave = students.map(s => {
        const input = records[s.id];
        if (!input) return null;
        let isCompound = selectedItemInfo?.isCompound;
        let val = isCompound ? parseFloat(calculateBmi(input.height, input.weight)) : parseFloat(input.value);
        if (isNaN(val)) return null;
        return { 
          studentId: s.id, 
          school, 
          item: batchItem, 
          date: format(date, 'yyyy-MM-dd'), 
          value: val,
          height: isCompound ? parseFloat(input.height) : undefined,
          weight: isCompound ? parseFloat(input.weight) : undefined
        };
      }).filter((r): r is any => r !== null);

      if (toSave.length) {
        const updated = await addOrUpdateRecords(school, students, toSave);
        onRecordUpdate(updated, 'update');
        setSavedIds(new Set(toSave.map(r => r.studentId)));
        toast({ title: "일괄 저장 완료" });
      }
    } finally { setIsSubmitting(false); }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학급/팀별 측정 기록</CardTitle>
        <CardDescription>아이들의 이전 기록을 참고하며 한 명씩 실시간으로 안전하게 저장하세요.</CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Select value={selectedGrade} onValueChange={v => { setSelectedGrade(v); setSelectedGroupId(''); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="학년" /></SelectTrigger><SelectContent>{[...new Set(allStudents.map((s: any) => s.grade))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((g: any) => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}</SelectContent></Select>
          <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={!selectedGrade}><SelectTrigger className="w-[120px]"><SelectValue placeholder="반" /></SelectTrigger><SelectContent><SelectItem value="all">전체</SelectItem>{[...new Set(allStudents.filter((s: any) => s.grade === selectedGrade).map((s: any) => s.classNum))].sort((a: any,b: any) => parseInt(a)-parseInt(b)).map((c: any) => <SelectItem key={c} value={c}>{c}반</SelectItem>)}</SelectContent></Select>
          <Select value={selectedGroupId} onValueChange={v => { setSelectedGroupId(v); setSelectedGrade(''); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="그룹 선택" /></SelectTrigger><SelectContent>{allTeamGroups.concat(sportsClubs as any).map((g: any) => <SelectItem key={g.id} value={g.id}>{g.description || g.name}</SelectItem>)}</SelectContent></Select>
          <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[200px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : "날짜"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent></Popover>
          <Select value={batchItem} onValueChange={v => { setBatchItem(v); setShowVideo(false); setShowGradeTable(false); }}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent></Select>
          <Button onClick={handleSaveAll} disabled={isSubmitting || !students.length} className="ml-auto font-bold">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}전체 저장</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-16">사진</TableHead>
                    <TableHead className="w-32">이름</TableHead>
                    <TableHead className="w-24 text-blue-600 font-bold">이전 기록</TableHead>
                    {selectedItemInfo?.isCompound ? (
                        <><TableHead className="w-24 text-center">키(cm)</TableHead><TableHead className="w-24 text-center">몸무게(kg)</TableHead><TableHead className="w-24 text-center">BMI</TableHead></>
                    ) : (
                        <TableHead className="text-center">현재 기록({selectedItemInfo?.unit})</TableHead>
                    )}
                    <TableHead className="w-24 text-right">작업</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {students.map(s => {
                const prev = getPreviousRecord(s.id);
                const current = records[s.id] || {};
                const isSaved = savedIds.has(s.id);
                return (
                <TableRow key={s.id} className={cn(isSaved && "bg-green-50/50 transition-colors")}>
                    <TableCell><Avatar className="w-10 h-10"><AvatarImage src={s.photoUrl} /><AvatarFallback>{s.name[0]}</AvatarFallback></Avatar></TableCell>
                    <TableCell><div className="flex flex-col"><span className="font-bold">{s.name}</span><span className="text-[10px] text-muted-foreground">{s.grade}-{s.classNum} {s.studentNum}번</span></div></TableCell>
                    <TableCell className="text-xs font-black text-blue-600 italic">{prev ? `${prev.value}${selectedItemInfo?.unit || ''}` : '-'}</TableCell>
                    {selectedItemInfo?.isCompound ? (
                        <><TableCell><Input type="number" value={current.height || ''} onChange={e => setBatchRecords({...records, [s.id]: {...current, height: e.target.value}})} className="text-center h-9" /></TableCell><TableCell><Input type="number" value={current.weight || ''} onChange={e => setBatchRecords({...records, [s.id]: {...current, weight: e.target.value}})} className="text-center h-9" /></TableCell><TableCell className="text-center font-bold text-primary text-sm">{calculateBmi(current.height, current.weight)}</TableCell></>
                    ) : (
                        <TableCell><Input type="number" value={current.value || ''} onChange={e => setBatchRecords({...records, [s.id]: {value: e.target.value}})} className="text-center max-w-[120px] mx-auto h-9" /></TableCell>
                    )}
                    <TableCell className="text-right">
                        <Button variant={isSaved ? "ghost" : "outline"} size="sm" className={cn("h-8 px-2 transition-all", isSaved && "text-green-600 font-bold")} onClick={() => handleIndividualSave(s.id)} disabled={savingId === s.id}>
                            {savingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            <span className="ml-1 hidden sm:inline">{isSaved ? '저장됨' : '저장'}</span>
                        </Button>
                    </TableCell>
                </TableRow>
                )})}
            </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}
