'use client';
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  exportToExcel,
  addOrUpdateRecords,
  deleteRecordsByDateAndItem,
  cleanUpDuplicateRecords,
  assignMissingAccessCodes,
  promoteStudents,
  getSchoolByName,
  updateSchoolSetting,
  rebuildAllStatistics,
} from "@/lib/store";
import type { Student, MeasurementItem, MeasurementRecord, School } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { parseExcel, exportToZip, exportNeisToExcel } from "@/lib/utils";
import { FileUp, FileDown, Loader2, Sparkles, KeyRound, Trash2, Search, Settings2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export function DatabaseManagement({ students, records, items, onUpdate }: { students: Student[], records: MeasurementRecord[], items: MeasurementItem[], onUpdate: () => void }) {
  const { school } = useAuth();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStudentInputDisabled, setIsStudentInputDisabled] = useState(false);

  const [deleteDate, setDeleteDate] = useState("");
  const [deleteItem, setDeleteItem] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [studentSearch, setStudentSearch] = useState("");
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);

  const [selectedExportItems, setSelectedExportItems] = useState<string[]>([
    '왕복오래달리기', '앉아윗몸 앞으로 굽히기', '악력', '50m 달리기', '신장', '체중'
  ]);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      if (school) {
        const sData = await getSchoolByName(school);
        if (sData) {
          setIsStudentInputDisabled(!!sData.isStudentInputDisabled);
        }
      }
    }
    loadSettings();
  }, [school]);

  const recordDates = useMemo(() => [...new Set(records.map(r => r.date))].sort((a,b) => new Date(b).getTime() - new Date(a).getTime()), [records]);

  const handleToggleStudentInput = async (checked: boolean) => {
    if (!school) return;
    const disabled = !checked; // Switch ON means 허용 (Not disabled)
    setIsStudentInputDisabled(disabled);
    try {
      await updateSchoolSetting(school, { isStudentInputDisabled: disabled });
      toast({ title: checked ? "학생 입력 허용" : "학생 입력 차단", description: `학생 대시보드의 입력 기능이 ${checked ? '활성화' : '비활성화'}되었습니다.` });
    } catch (e) {
      setIsStudentInputDisabled(!disabled);
      toast({ variant: 'destructive', title: '설정 변경 실패' });
    }
  };

  const handlePromotionExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      setIsProcessing(true);
      try {
        const promotionData = await parseExcel<any>(file);
        if (promotionData.length === 0) throw new Error("엑셀 파일에 데이터가 없습니다.");
        const updatedCount = await promoteStudents(school, students, promotionData);
        onUpdate();
        toast({ title: "진급 처리 완료", description: `${updatedCount}명의 학생 정보가 업데이트되었습니다.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "진급 처리 실패", description: error.message || "엑셀 형식을 확인해주세요." });
      } finally { setIsProcessing(false); }
    }
    event.target.value = ""; 
  };

  const handleRecordExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      setIsUploading(true);
      try {
        const parsedRecords = await parseExcel<any>(file);
        if (parsedRecords.length === 0) throw new Error("No data in Excel");
        await addOrUpdateRecords(school, students, parsedRecords);
        onUpdate();
        toast({ title: "기록 등록 완료", description: `기록 일괄 등록이 완료되었습니다.` });
      } catch (error) {
        toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일 형식이나 내용을 확인해주세요." });
      } finally { setIsUploading(false); }
    }
    event.target.value = ""; 
  };

  const handleSearchStudent = () => {
    if (!studentSearch.trim()) return;
    const found = students.filter(s => s.name.includes(studentSearch.trim()));
    if (found.length === 1) {
        setFoundStudent(found[0]);
        toast({ title: "학생 선택됨", description: `${found[0].name} 학생의 기록을 추출할 수 있습니다.`});
    } else if (found.length > 1) {
        toast({ variant: "default", title: "여러 명의 학생이 검색됨", description: "더 정확한 이름을 입력해주세요."});
        setFoundStudent(null);
    } else {
        toast({ variant: "destructive", title: "검색 결과 없음" });
        setFoundStudent(null);
    }
  };

  const handleDownloadStudentRecords = () => {
      if (!school || !foundStudent) return;
      const studentRecords = records.filter(r => r.studentId === foundStudent.id);
      if (studentRecords.length === 0) {
          toast({ variant: "destructive", title: "데이터 없음", description: "해당 학생의 기록이 없습니다." });
          return;
      }
      const dataToExport = studentRecords.map(r => ({
          학교: school, 학년: foundStudent.grade, 반: foundStudent.classNum, 번호: foundStudent.studentNum,
          이름: foundStudent.name, 성별: foundStudent.gender, 측정종목: r.item, 기록: r.value, 측정일: r.date,
      }));
      exportToExcel(`${school}_${foundStudent.name}_기록.xlsx`, dataToExport);
  };

  // 특정 학생 기록 NEIS PAPS 양식으로 추출
  const handleDownloadStudentRecordsNeis = (selectedItems: string[]) => {
    if (!school || !foundStudent) return;

    // 한국 학년도: 3월 이후면 현재 연도, 이전이면 전년도
    const now = new Date();
    const neisYear = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();

    const studentRecords = records.filter(r => r.studentId === foundStudent.id);
    if (studentRecords.length === 0) {
      toast({ variant: "destructive", title: "데이터 없음", description: "해당 학생의 기록이 없습니다." });
      return;
    }

    // 날짜 오름차순 정렬 (기록 차수 구분용)
    const sortedRecs = [...studentRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 종목 필터링 헬퍼
    const findRec = (keywords: string[]) =>
      sortedRecs.filter(r => keywords.some(kw => r.item.includes(kw)));

    const getValue = (recs: MeasurementRecord[], idx = 0): string | number => {
      const r = recs[idx];
      return r !== undefined ? r.value : '';
    };

    // 체크박스 선택 여부에 따라 값을 반환하는 헬퍼
    const getSelectedValue = (itemKey: string, recs: MeasurementRecord[], idx = 0): string | number => {
      if (!selectedItems.includes(itemKey)) return '';
      return getValue(recs, idx);
    };

    const 왕복 = findRec(['왕복오래달리기']);
    const 앉아 = findRec(['앉아윗몸앞으로굽히기']);
    const 악력오른 = findRec(['악력']).filter(r => r.item.includes('오른'));
    const 악력왼 = findRec(['악력']).filter(r => r.item.includes('왼'));
    const 악력전체 = findRec(['악력']);
    const 달리기 = findRec(['50m', '50 m']);
    const 신장 = findRec(['신장', '키']);
    const 체중 = findRec(['체중', '몸무게']);

    const hasHandSplit = 악력오른.length > 0 || 악력왼.length > 0;

    const row = {
      '학년도': neisYear,
      '학년': parseInt(foundStudent.grade),
      '반명': parseInt(foundStudent.classNum),
      '반코드': foundStudent.classNum.padStart(2, '0'),
      '번호': parseInt(foundStudent.studentNum),
      '학생성명': foundStudent.name,
      '왕복오래달리기(회)': getSelectedValue('왕복오래달리기', 왕복),
      '앉아윗몸 앞으로 굽히기(cm) 1차': getSelectedValue('앉아윗몸 앞으로 굽히기', 앉아, 0),
      '앉아윗몸 앞으로 굽히기(cm) 2차': getSelectedValue('앉아윗몸 앞으로 굽히기', 앉아, 1),
      '악력(kg) 1차 오른쪽': hasHandSplit ? getSelectedValue('악력', 악력오른, 0) : getSelectedValue('악력', 악력전체, 0),
      '악력(kg) 1차 왼쪽': hasHandSplit ? getSelectedValue('악력', 악력왼, 0) : '',
      '악력(kg) 2차 오른쪽': hasHandSplit ? getSelectedValue('악력', 악력오른, 1) : getSelectedValue('악력', 악력전체, 1),
      '악력(kg) 2차 왼쪽': hasHandSplit ? getSelectedValue('악력', 악력왼, 1) : '',
      '50m 달리기(초)': getSelectedValue('50m 달리기', 달리기),
      '신장(cm)': getSelectedValue('신장', 신장),
      '체중(cm)': getSelectedValue('체중', 체중),
    };

    const filename = `${school}_${foundStudent.name}_NEIS_PAPS_${neisYear}`;
    exportNeisToExcel(filename, [row]);
    toast({ title: '학생 기록 추출 완료', description: `${foundStudent.name} 학생의 선택된 기록이 NEIS 양식으로 저장되었습니다.` });
  };

  // NEIS PAPS 일괄입력 양식 내보내기
  const handleNeisExport = () => {
    if (!school || students.length === 0) {
      toast({ variant: 'destructive', title: 'NEIS 내보내기 실패', description: '학생 데이터가 없습니다.' });
      return;
    }

    // 한국 학년도: 3월 이후면 현재 연도, 이전이면 전년도
    const now = new Date();
    const neisYear = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();

    // 학생별 기록 그룹핑 (날짜순 정렬)
    const recordsByStudent = new Map<string, MeasurementRecord[]>();
    records.forEach(r => {
      if (!recordsByStudent.has(r.studentId)) recordsByStudent.set(r.studentId, []);
      recordsByStudent.get(r.studentId)!.push(r);
    });
    // 날짜순(오름차순) 정렬 → 오래된 것이 1차
    recordsByStudent.forEach(recs => recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

    // 아이템 이름 패턴으로 기록 찾기 (가장 최근 기록 우선)
    const findRec = (recs: MeasurementRecord[], ...keywords: string[]) =>
      recs.filter(r => keywords.some(kw => r.item.includes(kw)));

    // 학생 정렬: 학년 → 반 → 번호
    const sorted = [...students].sort((a, b) => {
      if (a.grade !== b.grade) return parseInt(a.grade) - parseInt(b.grade);
      if (a.classNum !== b.classNum) return parseInt(a.classNum) - parseInt(b.classNum);
      return parseInt(a.studentNum) - parseInt(b.studentNum);
    });

    const getValue = (recs: MeasurementRecord[], idx = 0): string | number => {
      const r = recs[idx];
      return r !== undefined ? r.value : '';
    };

    const data = sorted.map(student => {
      const recs = recordsByStudent.get(student.id) || [];

      // 각 PAPS 종목별 기록 추출
      const 왕복 = findRec(recs, '왕복오래달리기');
      // 앉아윗몸앞으로굽히기: 다른 날짜 2회 측정 → 날짜순 1차/2차
      const 앉아 = findRec(recs, '앉아윗몸앞으로굽히기');
      // 악력: 오른손/왼손 별도 항목이면 분리, 아니면 통합 사용
      const 악력오른 = findRec(recs, '악력').filter(r => r.item.includes('오른'));
      const 악력왼 = findRec(recs, '악력').filter(r => r.item.includes('왼'));
      const 악력전체 = findRec(recs, '악력'); // 구분 없이 저장된 경우
      const 달리기 = findRec(recs, '50m', '50 m');
      const 신장 = findRec(recs, '신장', '키');
      const 체중 = findRec(recs, '체중', '몸무게');

      // 악력 오른손/왼손 분리 여부
      const hasHandSplit = 악력오른.length > 0 || 악력왼.length > 0;

      return {
        '학년도': neisYear,
        '학년': parseInt(student.grade),
        '반명': parseInt(student.classNum),
        '반코드': student.classNum.padStart(2, '0'),
        '번호': parseInt(student.studentNum),
        '학생성명': student.name,
        '왕복오래달리기(회)': getValue(왕복),
        '앉아윗몸 앞으로 굽히기(cm) 1차': getValue(앉아, 0),
        '앉아윗몸 앞으로 굽히기(cm) 2차': getValue(앉아, 1),
        '악력(kg) 1차 오른쪽': hasHandSplit ? getValue(악력오른, 0) : getValue(악력전체, 0),
        '악력(kg) 1차 왼쪽': hasHandSplit ? getValue(악력왼, 0) : '',
        '악력(kg) 2차 오른쪽': hasHandSplit ? getValue(악력오른, 1) : getValue(악력전체, 1),
        '악력(kg) 2차 왼쪽': hasHandSplit ? getValue(악력왼, 1) : '',
        '50m 달리기(초)': getValue(달리기),
        '신장(cm)': getValue(신장),
        '체중(cm)': getValue(체중),
      };
    });

    const filename = `${school}_NEIS_PAPS_${neisYear}`;
    exportNeisToExcel(filename, data);
    toast({ title: 'NEIS PAPS 양식 내보내기 완료', description: `총 ${data.length}명의 기록이 저장되었습니다.` });
  };

  const handleBulkDelete = async () => {
    if (!school || !deleteDate || !deleteItem) return;
    setIsDeleting(true);
    try {
      const deletedCount = await deleteRecordsByDateAndItem(school, deleteDate, deleteItem);
      onUpdate();
      toast({ title: "삭제 완료", description: `${deleteDate}의 ${deleteItem === 'all' ? '모든' : deleteItem} 기록 ${deletedCount}건이 삭제되었습니다.` });
      setDeleteDate(""); setDeleteItem("");
    } finally { setIsDeleting(false); }
  };

  const handleRebuildStats = async () => {
    if (!school) return;
    setIsProcessing(true);
    try {
      await rebuildAllStatistics(school);
      toast({ title: "통계 재계산 완료", description: "모든 종목의 학년별 평균과 순위 데이터가 업데이트되었습니다." });
      onUpdate();
    } catch (e) {
      toast({ variant: "destructive", title: "재계산 실패" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>DB 유틸리티</CardTitle>
        <CardDescription>
          학생 진급 처리, 기록 일괄 등록 및 다운로드, 데이터 정리 등 데이터베이스 관련 작업을 수행합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 0. 시스템 설정 */}
        <div className="border-b pb-6 bg-primary/5 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">시스템 권한 설정</h3>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">학생 본인의 기록 입력 허용</Label>
              <p className="text-sm text-muted-foreground">허용 시 학생 대시보드에 '기록 입력' 탭이 활성화됩니다.</p>
            </div>
            <Switch 
              checked={!isStudentInputDisabled} 
              onCheckedChange={handleToggleStudentInput} 
            />
          </div>
        </div>

        {/* 1. 진급 처리 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-2">학생 진급 처리</h3>
          <p className="text-sm text-muted-foreground mb-4">
            새 학년이 시작될 때 학생들의 학년, 반, 번호를 일괄 업데이트합니다. 기존 기록은 그대로 유지됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById("promotion-upload")?.click()} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              진급 파일 업로드
            </Button>
            <input type="file" id="promotion-upload" accept=".xlsx" onChange={handlePromotionExcelUpload} className="hidden" />
            <Button variant="link" onClick={() => exportToExcel(`${school}_학생_진급_템플릿.xlsx`, [{ school, grade: "1", classNum: "1", studentNum: "1", name: "홍길동", newGrade: "2", newClassNum: "1", newStudentNum: "1" }])}>
              진급용 템플릿 다운로드
            </Button>
          </div>
        </div>

        {/* 2. 기록 등록 및 추출 */}
        <div className="border-b pb-6 space-y-4">
          <h3 className="text-lg font-semibold">기록 등록 및 다운로드</h3>
          <p className="text-sm text-muted-foreground">
            엑셀 파일을 사용하여 여러 학생의 기록을 한 번에 등록하거나, 특정 학생/전체 기록을 엑셀로 백업합니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById("record-upload")?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              기록 일괄 등록
            </Button>
            <input type="file" id="record-upload" accept=".xlsx" onChange={handleRecordExcelUpload} className="hidden" />
            <Button variant="link" onClick={() => exportToZip("기록_등록_템플릿.zip", [{ name: "기록_등록_템플릿.xlsx", data: [{ school, grade: "1", classNum: "1", studentNum: "1", name: "홍길동", item: "50m 달리기", 기록: 9.5, 측정일: format(new Date(), 'yyyy-MM-dd')}] }, { name: "등록된_종목_목록.xlsx", data: items.map(item => ({ '종목명': item.name, '단위': item.unit })) }])}>
              기록용 템플릿(Zip) 다운로드
            </Button>
          </div>
          
          <div className="space-y-2 pt-2">
            <Label>특정 학생 기록 추출</Label>
            <div className="flex flex-wrap gap-2 items-center">
                <Input placeholder="학생 이름..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="w-full sm:w-auto" onKeyDown={e => e.key === 'Enter' && handleSearchStudent()} />
                <Button variant="secondary" onClick={handleSearchStudent}><Search className="h-4 w-4 mr-2" />학생 찾기</Button>
                <Dialog open={isExportDialogOpen} onOpenChange={(open) => {
                  setIsExportDialogOpen(open);
                  if (open) {
                    setSelectedExportItems([
                      '왕복오래달리기', '앉아윗몸 앞으로 굽히기', '악력', '50m 달리기', '신장', '체중'
                    ]);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={!foundStudent}>
                      <FileDown className="mr-2 h-4 w-4" />
                      {foundStudent ? `${foundStudent.name} 기록 추출` : '기록 추출'}
                    </Button>
                  </DialogTrigger>
                  {foundStudent && (
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{foundStudent.name} 학생 기록 추출 설정</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <p className="text-sm text-muted-foreground">
                          NEIS PAPS 양식으로 추출할 종목을 선택해주세요. (선택 해제된 종목은 빈 칸으로 내보내집니다.)
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { id: '왕복오래달리기', label: '왕복오래달리기' },
                            { id: '앉아윗몸 앞으로 굽히기', label: '앉아윗몸 앞으로 굽히기' },
                            { id: '악력', label: '악력' },
                            { id: '50m 달리기', label: '50m 달리기' },
                            { id: '신장', label: '신장(cm)' },
                            { id: '체중', label: '체중(cm)' },
                          ].map((item) => {
                            const isChecked = selectedExportItems.includes(item.id);
                            return (
                              <div key={item.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`export-item-${item.id}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedExportItems([...selectedExportItems, item.id]);
                                    } else {
                                      setSelectedExportItems(selectedExportItems.filter(x => x !== item.id));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`export-item-${item.id}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {item.label}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">취소</Button>
                        </DialogClose>
                        <Button onClick={() => {
                          handleDownloadStudentRecordsNeis(selectedExportItems);
                          setIsExportDialogOpen(false);
                        }}>
                          엑셀 다운로드
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  )}
                </Dialog>
                <Button variant="outline" onClick={() => exportToExcel(`${school}_전체_기록.xlsx`, records.map(r => { const s = students.find(st => st.id === r.studentId); return { 학교: school, 학년: s?.grade, 반: s?.classNum, 번호: s?.studentNum, 이름: s?.name, 성별: s?.gender, 측정종목: r.item, 기록: r.value, 측정일: r.date } }))}>
                    <FileDown className="mr-2 h-4 w-4" />전체 기록 백업
                </Button>
                <Button variant="default" onClick={handleNeisExport} disabled={students.length === 0}>
                    <FileDown className="mr-2 h-4 w-4" />NEIS PAPS 양식 내보내기
                </Button>
            </div>
          </div>
        </div>

        {/* 3. 기록 일괄 삭제 */}
        <div className="border-b pb-6">
          <h3 className="text-lg font-semibold mb-2">기록 일괄 삭제</h3>
          <p className="text-sm text-muted-foreground mb-4">특정 날짜에 잘못 입력된 종목의 모든 기록을 한 번에 삭제합니다.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={deleteDate} onValueChange={setDeleteDate}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="삭제할 날짜 선택" /></SelectTrigger>
              <SelectContent>{recordDates.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deleteItem} onValueChange={setDeleteItem}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="삭제할 종목 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 종목</SelectItem>
                {items.map(i => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!deleteDate || !deleteItem || isDeleting}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  일괄 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle><AlertDialogDescription>{deleteDate}의 선택한 기록이 영구 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>삭제</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* 4. 기타 유틸리티 */}
        <div>
          <h3 className="text-lg font-semibold mb-2">데이터 정리 및 복구</h3>
          <p className="text-sm text-muted-foreground mb-4">
            중복 기록을 정리하거나, 시스템 오류 등으로 누락된 학생의 접속 코드를 일괄 생성합니다.
            <br />
            <span className="text-xs text-blue-600 font-medium">* 새로 생성된 코드는 '학생 관리' 탭의 명단에서 확인하실 수 있습니다.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRebuildStats} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              통계 데이터 전체 재계산
            </Button>
            <Button variant="outline" onClick={async () => { setIsProcessing(true); await cleanUpDuplicateRecords(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}>
              <Sparkles className="mr-2 h-4 w-4" /> 중복 데이터 정리
            </Button>
            <Button variant="outline" onClick={async () => { setIsProcessing(true); await assignMissingAccessCodes(school!); onUpdate(); setIsProcessing(false); }} disabled={isProcessing}>
              <KeyRound className="mr-2 h-4 w-4" /> 미할당 접속 코드 생성
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
