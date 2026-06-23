
'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { addOrUpdateRecord } from '@/lib/store';
import { Student, MeasurementItem, MeasurementRecord } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Calendar as CalendarIcon, Youtube, ClipboardList, X, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { papsGradeStandards } from '@/lib/paps';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function IndividualInput({ allStudents, activeItems, onRecordUpdate }: { allStudents: Student[], activeItems: MeasurementItem[], onRecordUpdate: any }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [itemName, setItemName] = useState('');
  const [val, setVal] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showVideo, setShowVideo] = useState(false);
  const [showGradeTable, setShowGradeTable] = useState(false);
  
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  const selectedItemInfo = useMemo(() => activeItems.find(i => i.name === itemName), [itemName, activeItems]);

  const handleSearch = () => {
    if (!search.trim()) return;
    const found = allStudents.filter(s => s.name.includes(search.trim()));
    if (found.length === 1) {
      setStudent(found[0]);
      setSearch('');
    } else if (found.length > 1) {
      setFoundStudents(found);
      setIsSelectionDialogOpen(true);
    } else {
      toast({ variant: "destructive", title: "학생을 찾을 수 없습니다." });
    }
  };

  const handleSave = async () => {
    if (!school || !student || !itemName || !date) return;
    setIsSubmitting(true);
    try {
      const isCompound = selectedItemInfo?.isCompound;
      let finalVal = isCompound ? parseFloat(calculateBmi(height, weight)) : parseFloat(val);
      if (isNaN(finalVal)) return;

      const rec = await addOrUpdateRecord({ 
        studentId: student.id, 
        school, 
        item: itemName, 
        date: format(date, 'yyyy-MM-dd'), 
        value: finalVal,
        height: isCompound ? parseFloat(height) : undefined,
        weight: isCompound ? parseFloat(weight) : undefined
      });
      onRecordUpdate([rec], 'update');
      toast({ title: "저장 완료" });
      setVal('');
      setHeight('');
      setWeight('');
    } catch (e) { 
      console.error('[IndividualInput] 저장 실패 상세 에러:', e);
      toast({ variant: "destructive", title: "저장 실패", description: (e as any)?.message || '알 수 없는 오류' }); 
    }
    finally { setIsSubmitting(false); }
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const calculateBmi = (hStr: string, wStr: string): string => {
    const h = parseFloat(hStr);
    const w = parseFloat(wStr);
    if (!isNaN(h) && !isNaN(w) && h > 0) {
      return (w / ((h / 100) ** 2)).toFixed(2);
    }
    return '';
  };

  const renderGradeRanges = () => {
    if (!student || !selectedItemInfo) return null;
    const gradeToUse = student.grade;
    const itemKey = itemName === '무릎 대고 팔굽혀펴기' ? '팔굽혀펴기' : itemName;
    const itemStandards = papsGradeStandards[gradeToUse]?.[itemKey];
    
    if (!itemStandards) return <TableCell colSpan={5} className="text-center text-muted-foreground">데이터 없음</TableCell>;

    const ranges = student.gender === '남' ? itemStandards.male : itemStandards.female;
    const unit = selectedItemInfo.unit;
    const type = itemStandards.type;

    return [1, 2, 3, 4, 5].map(g => {
      const gradeRanges = ranges.filter(r => r.grade === g);
      if (gradeRanges.length === 0) return <TableCell key={g} className="text-center">-</TableCell>;

      const rangeTexts = gradeRanges.map(r => {
        if (r.max === Infinity) return `${r.min}${unit} ↑`;
        if (r.min === 1 || r.min === -Infinity || (type === 'time' && r.min === 0)) return `${r.max}${unit} ↓`;
        return `${r.min}~${r.max}${unit}`;
      });

      return (
        <TableCell key={g} className="text-center text-[10px] sm:text-xs break-keep px-1">
          {rangeTexts.join(' / ')}
        </TableCell>
      );
    });
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>개별 학생 기록 입력</CardTitle>
        <div className="flex gap-2 pt-4">
          <Input placeholder="이름 검색..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <Button onClick={handleSearch}><Search className="h-4 w-4 mr-2" />검색</Button>
        </div>
      </CardHeader>
      
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>학생 선택</DialogTitle></DialogHeader>
              <div className="max-h-[60vh] overflow-y-auto">
                  <Table>
                      <TableHeader><TableRow><TableHead>이름</TableHead><TableHead>학년-반</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                          {foundStudents.map((s) => (
                              <TableRow key={s.id}><TableCell>{s.name}</TableCell><TableCell>{s.grade}-{s.classNum}</TableCell><TableCell><Button size="sm" onClick={() => { setStudent(s); setIsSelectionDialogOpen(false); setSearch(''); }}>선택</Button></TableCell></TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>
          </DialogContent>
      </Dialog>

      {student && (
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-lg border border-primary/10">
            <Avatar className="w-20 h-20 border-2 border-background"><AvatarImage src={student.photoUrl} /><AvatarFallback>{student.name[0]}</AvatarFallback></Avatar>
            <div>
              <p className="font-black text-xl text-primary">{student.name}</p>
              <p className="text-sm font-medium text-muted-foreground">{student.grade}학년 {student.classNum}반 {student.studentNum}번 ({student.gender})</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setStudent(null)}><X className="h-4 w-4" /> 변경</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
              </PopoverContent>
            </Popover>

            <Select value={itemName} onValueChange={v => { setItemName(v); setShowVideo(false); setShowGradeTable(false); }}>
              <SelectTrigger>
                <SelectValue placeholder="종목 선택" />
              </SelectTrigger>
              <SelectContent>
                {activeItems.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedItemInfo && (
            <div className="flex flex-wrap gap-2">
              {selectedItemInfo.videoUrl && (
                <Button variant="outline" size="sm" onClick={() => setShowVideo(!showVideo)}>
                  <Youtube className="mr-2 h-4 w-4 text-red-600" />
                  {showVideo ? '영상 닫기' : '참고 영상 보기'}
                </Button>
              )}
              {selectedItemInfo.isPaps && (
                <Button variant="outline" size="sm" onClick={() => setShowGradeTable(!showGradeTable)}>
                  <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                  {showGradeTable ? '기준표 닫기' : '등급 기준표 보기'}
                </Button>
              )}
            </div>
          )}

          {showVideo && selectedItemInfo?.videoUrl && (
            <div className="aspect-video w-full rounded-lg overflow-hidden border bg-black animate-in fade-in zoom-in-95">
              <iframe
                width="100%" height="100%"
                src={getYouTubeEmbedUrl(selectedItemInfo.videoUrl)!}
                title="참고 영상"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          )}

          {showGradeTable && selectedItemInfo?.isPaps && (
            <div className="overflow-x-auto rounded-md border bg-muted/30 p-2 animate-in fade-in zoom-in-95">
              <p className="text-xs font-bold mb-2 px-1 text-primary">{itemName} 등급 기준 ({student.gender}학생)</p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-background">
                    <TableHead className="text-center h-8 text-[10px] p-1">1등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">2등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">3등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">4등급</TableHead>
                    <TableHead className="text-center h-8 text-[10px] p-1">5등급</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-background">
                    {renderGradeRanges()}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {selectedItemInfo?.isCompound ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>키 (cm)</Label>
                <Input type="number" placeholder="0.0" value={height} onChange={e => setHeight(e.target.value)} className="text-xl py-6 font-bold text-center" />
              </div>
              <div className="space-y-2">
                <Label>몸무게 (kg)</Label>
                <Input type="number" placeholder="0.0" value={weight} onChange={e => setWeight(e.target.value)} className="text-xl py-6 font-bold text-center" />
              </div>
              <div className="col-span-2 p-3 bg-primary/5 rounded-lg border border-primary/10 flex justify-between items-center">
                <span className="font-bold text-muted-foreground">계산된 BMI:</span>
                <span className="text-2xl font-black text-primary">{calculateBmi(height, weight) || '0.00'}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>기록 입력 ({selectedItemInfo?.unit || ''})</Label>
              <Input type="number" placeholder="숫자만 입력하세요" value={val} onChange={e => setVal(e.target.value)} className="text-2xl py-8 font-black text-center" />
            </div>
          )}

          <Button className="w-full py-8 text-lg font-black shadow-xl transition-all active:scale-[0.98]" onClick={handleSave} disabled={isSubmitting || !itemName || (selectedItemInfo?.isCompound ? (!height || !weight) : !val)}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            기록 저장하기
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
