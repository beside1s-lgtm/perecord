
'use client';
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteStudentAndAssociatedRecords,
  addStudent,
  updateStudent,
  exportToExcel,
} from "@/lib/store";
import type {
  Student,
  StudentToAdd,
  StudentToUpdate,
  SchoolHistoryEntry,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { parseExcel, cn } from "@/lib/utils";
import {
  UserPlus,
  Trash2,
  FileUp,
  FileDown,
  Loader2,
  Pencil,
  Search,
  ChevronDown,
  History,
  Stethoscope,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddStudentDialog } from "./student-management/AddStudentDialog";
import { EditStudentDialog } from "./student-management/EditStudentDialog";
import { PhotoEditDialog } from "./student-management/PhotoEditDialog";
import { BatchPhotoUploadDialog } from "./student-management/BatchPhotoUploadDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface StudentManagementProps {
  students: Student[];
  onStudentsUpdate: () => void;
}

// ──────────────────────────────────────────────────────────
// 엑셀 템플릿 생성 헬퍼
// ──────────────────────────────────────────────────────────

/** 기본 명부 등록 양식 다운로드 */
function downloadBasicTemplate() {
  const rows = [
    { 학년: '3', 반: '1', 번호: '1', 이름: '홍길동', 성별: '남', 개인코드: '' },
  ];
  exportToExcel('기본_명부_등록양식.xlsx', rows);
}

/** 건강기록부 통합 양식 다운로드 */
function downloadHealthTemplate() {
  const rows = [
    { 학년: '3', 반: '1', 번호: '1', 이름: '홍길동', 성별: '남', 주민등록번호: '000101-3000000', 보호자명: '홍부모', 혈액형: 'A형', 정식학교명: '', 담임교사명: '' },
  ];
  exportToExcel('건강기록부_등록양식.xlsx', rows);
}

/** 과거 이력 등록 양식 다운로드 (B안: 학년도 컬럼 포함) */
function downloadHistoryTemplate() {
  const rows = [
    { 학년도: '2024', 학년: '2', 반: '1', 번호: '1', 이름: '홍길동', 담임성명: '김선생' },
    { 학년도: '2023', 학년: '1', 반: '2', 번호: '3', 이름: '홍길동', 담임성명: '이선생' },
  ];
  exportToExcel('과거이력_등록양식.xlsx', rows);
}

// ──────────────────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────────────────

export function StudentManagement({
  students,
  onStudentsUpdate,
}: StudentManagementProps) {
  const { school } = useAuth();
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedClassNum, setSelectedClassNum] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // 숨김 file input refs
  const basicInputRef = useRef<HTMLInputElement>(null);
  const healthInputRef = useRef<HTMLInputElement>(null);
  const historyInputRef = useRef<HTMLInputElement>(null);

  const { grades, classNumsByGrade } = useMemo(() => {
    const grades = [
      ...new Set(students.map((s) => s.grade)),
    ].sort((a, b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          students.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort((a, b) => parseInt(a) - parseInt(b));
    });
    return { grades, classNumsByGrade };
  }, [students]);

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedGrade !== "all") {
      filtered = filtered.filter((s) => s.grade === selectedGrade);
      if (selectedClassNum !== "all") {
        filtered = filtered.filter((s) => s.classNum === selectedClassNum);
      }
    }
    if (searchTerm) {
      filtered = filtered.filter((s) => s.name.includes(searchTerm));
    }
    return filtered;
  }, [students, selectedGrade, selectedClassNum, searchTerm]);

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const gradeA = parseInt(a.grade);
      const gradeB = parseInt(b.grade);
      if (gradeA !== gradeB) return gradeA - gradeB;
      const classA = parseInt(a.classNum);
      const classB = parseInt(b.classNum);
      if (classA !== classB) return classA - classB;
      return parseInt(a.studentNum) - parseInt(b.studentNum);
    });
  }, [filteredStudents]);

  const selectedIds = useMemo(
    () => Object.keys(selection).filter((id) => selection[id]),
    [selection]
  );
  
  const selectedStudentForEdit = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return students.find(s => s.id === selectedIds[0]) || null;
  }, [selectedIds, students]);

  useEffect(() => {
    setSelection({});
  }, [selectedGrade, selectedClassNum]);

  // ── 핸들러 ──────────────────────────────────────────────

  const handleAddStudent = async (studentData: StudentToAdd) => {
    if (!school) return;
    await addStudent(school, studentData, students);
    onStudentsUpdate(); 
    toast({ title: "학생 추가 완료", description: `${studentData.name} 학생을 등록했습니다.` });
  };
  
  const handleUpdateStudent = async (studentData: StudentToUpdate) => {
    if (!school || !editingStudent) return;
    await updateStudent(school, editingStudent.id, studentData);
    setEditingStudent(null);
    onStudentsUpdate();
    toast({ title: "학생 정보 수정 완료", description: `${studentData.name} 학생의 정보가 수정되었습니다.` });
  };
  
  const handleUpdatePhoto = async (studentId: string, photoUrl: string) => {
    if (!school) return;
    await updateStudent(school, studentId, { photoUrl });
    onStudentsUpdate();
    toast({ title: "사진 업데이트 완료", description: `학생 사진이 성공적으로 변경되었습니다.` });
  };

  const handleDeleteSelected = async () => {
    if (!school || selectedIds.length === 0) return;
    setIsProcessing(true);
    try {
      await Promise.all(selectedIds.map(id => deleteStudentAndAssociatedRecords(school, id)));
      setSelection({});
      onStudentsUpdate();
      toast({ variant: "destructive", title: "삭제 완료", description: `${selectedIds.length}명의 학생 정보와 기록을 삭제했습니다.` });
    } catch (error) {
      toast({ variant: "destructive", title: "삭제 실패" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── 다운로드 ────────────────────────────────────────────

  const handleDownloadList = () => {
    if (!school) return;
    let label = "";
    if (selectedGrade === "all") {
      label = "전체_학생";
    } else {
      label = `${selectedGrade}학년`;
      if (selectedClassNum !== "all") {
        label += `_${selectedClassNum}반`;
      } else {
        label += "_전체";
      }
    }
    const dataToExport = sortedStudents.map((s) => ({
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.studentNum,
      '이름': s.name,
      '성별': s.gender,
      '개인코드': s.personalCode || '',
      '접속코드': s.accessCode,
    }));
    exportToExcel(`${school}_${label}_명단.xlsx`, dataToExport);
    toast({ title: "다운로드 시작", description: `${label.replace(/_/g, ' ')} 기본 명단을 다운로드합니다.` });
  };

  const handleDownloadHealthList = () => {
    if (!school) return;
    let label = "";
    if (selectedGrade === "all") {
      label = "전체_학생";
    } else {
      label = `${selectedGrade}학년`;
      if (selectedClassNum !== "all") label += `_${selectedClassNum}반`;
      else label += "_전체";
    }
    const dataToExport = sortedStudents.map((s) => ({
      '학년': s.grade,
      '반': s.classNum,
      '번호': s.studentNum,
      '이름': s.name,
      '성별': s.gender,
      '개인코드': s.personalCode || '',
      '주민등록번호': s.residentRegistrationNumber || '',
      '보호자명': s.guardianName || '',
      '혈액형': s.bloodType || '',
      '정식학교명': s.officialSchoolName || s.school || '',
      '담임교사명': s.teacherName || '',
      '접속코드': s.accessCode,
    }));
    exportToExcel(`${school}_${label}_건강기록부_명단.xlsx`, dataToExport);
    toast({ title: "다운로드 시작", description: `건강기록부 통합 명단을 다운로드합니다.` });
  };

  // ── 업로드: 1) 기본 명부 등록 ──────────────────────────

  const handleBasicUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !school) { event.target.value = ""; return; }
    setIsUploading(true);
    try {
      const rows = await parseExcel<{
        학년: string; 반: string; 번호: string; 이름: string;
        성별: string; 개인코드?: string;
      }>(file);
      let added = 0;
      let skipped = 0;
      await Promise.all(rows.map((r) => {
        const grade = String(r.학년 ?? '').trim();
        const classNum = String(r.반 ?? '').trim();
        const studentNum = String(r.번호 ?? '').trim();
        const name = String(r.이름 ?? '').trim();
        const gender = (r.성별 === '여' ? '여' : '남') as '남' | '여';
        if (!grade || !classNum || !studentNum || !name) return Promise.resolve();
        const exists = students.some(
          st => st.grade === grade && st.classNum === classNum &&
                st.studentNum === studentNum && st.name === name
        );
        if (exists) { skipped++; return Promise.resolve(); }
        added++;
        const toAdd: StudentToAdd = {
          school,
          grade,
          classNum,
          studentNum,
          name,
          gender,
          personalCode: r.개인코드 ? String(r.개인코드).trim() : undefined,
        };
        return addStudent(school, toAdd, students);
      }));
      onStudentsUpdate();
      toast({
        title: "📋 기본 명부 등록 완료",
        description: `${added}명 등록, ${skipped}명 중복 건너뜀`,
      });
    } catch {
      toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일 형식이 올바르지 않습니다." });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // ── 업로드: 2) 건강기록부 통합 등록 ────────────────────

  const handleHealthUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !school) { event.target.value = ""; return; }
    setIsUploading(true);
    try {
      const rows = await parseExcel<{
        학년: string; 반: string; 번호: string; 이름: string;
        성별: string; 개인코드?: string;
        주민등록번호?: string; 보호자명?: string; 혈액형?: string;
        정식학교명?: string; 담임교사명?: string;
      }>(file);
      let added = 0;
      let updated = 0;
      await Promise.all(rows.map(async (r) => {
        const grade = String(r.학년 ?? '').trim();
        const classNum = String(r.반 ?? '').trim();
        const studentNum = String(r.번호 ?? '').trim();
        const name = String(r.이름 ?? '').trim();
        const gender = (r.성별 === '여' ? '여' : '남') as '남' | '여';
        if (!grade || !classNum || !studentNum || !name) return;

        const rrn = r.주민등록번호 ? String(r.주민등록번호).trim() : undefined;
        const guardianName = r.보호자명 ? String(r.보호자명).trim() : undefined;
        const bloodType = r.혈액형 ? String(r.혈액형).trim() : undefined;
        const officialSchoolName = r.정식학교명 ? String(r.정식학교명).trim() : undefined;
        const teacherName = r.담임교사명 ? String(r.담임교사명).trim() : undefined;
        const personalCode = r.개인코드 ? String(r.개인코드).trim() : undefined;

        const existing = students.find(
          st => st.grade === grade && st.classNum === classNum &&
                st.studentNum === studentNum && st.name === name
        );

        if (existing) {
          // 기존 학생 → 건강기록부 필드만 업데이트
          const patch: StudentToUpdate = {};
          if (rrn) patch.residentRegistrationNumber = rrn;
          if (guardianName) patch.guardianName = guardianName;
          if (bloodType) patch.bloodType = bloodType;
          if (officialSchoolName) patch.officialSchoolName = officialSchoolName;
          if (teacherName) patch.teacherName = teacherName;
          if (personalCode) patch.personalCode = personalCode;
          if (Object.keys(patch).length > 0) {
            updated++;
            await updateStudent(school, existing.id, patch);
          }
        } else {
          // 신규 학생
          added++;
          const history: SchoolHistoryEntry[] = [];
          if (officialSchoolName || teacherName) {
            history.push({
              schoolName: officialSchoolName || school,
              grade,
              classNum,
              studentNum,
              teacherName: teacherName || '-',
            });
          }
          const toAdd: StudentToAdd = {
            school,
            grade,
            classNum,
            studentNum,
            name,
            gender,
            personalCode,
            residentRegistrationNumber: rrn,
            guardianName,
            bloodType,
            officialSchoolName,
            teacherName,
            schoolHistory: history,
          };
          await addStudent(school, toAdd, students);
        }
      }));
      onStudentsUpdate();
      toast({
        title: "🏥 건강기록부 통합 등록 완료",
        description: `${added}명 신규 등록, ${updated}명 건강기록부 정보 업데이트`,
      });
    } catch {
      toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일 형식이 올바르지 않습니다." });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // ── 업로드: 3) 과거 학년도 이력 등록 (B안: 엑셀에 학년도 컬럼 포함) ──

  const handleHistoryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !school) { event.target.value = ""; return; }
    setIsUploading(true);
    try {
      const rows = await parseExcel<{
        학년도: string; 학년: string; 반: string; 번호: string;
        이름: string; 담임성명: string;
      }>(file);

      let matched = 0;
      let notFound = 0;

      // 학생별 업데이트를 모아서 배치 처리
      const studentUpdates = new Map<string, SchoolHistoryEntry[]>();

      for (const r of rows) {
        const yearStr = String(r.학년도 ?? '').trim();
        const grade = String(r.학년 ?? '').trim();
        const classNum = String(r.반 ?? '').trim();
        const studentNum = String(r.번호 ?? '').trim();
        const name = String(r.이름 ?? '').trim();
        const teacherName = String(r.담임성명 ?? '').trim();
        if (!yearStr || !grade || !classNum || !studentNum || !name) continue;

        // 이름으로 학생 찾기 (동명이인 고려: 이름+학년 조합)
        const found = students.find(s => s.name === name);
        if (!found) { notFound++; continue; }

        matched++;
        const prev = studentUpdates.get(found.id) ?? [...(found.schoolHistory ?? [])];

        // 같은 연도+학년 이력이 있으면 덮어쓰기
        const idx = prev.findIndex(h => h.year === yearStr && h.grade === grade);
        const newEntry: SchoolHistoryEntry = {
          year: yearStr,
          schoolName: found.officialSchoolName || found.school || school,
          grade,
          classNum,
          studentNum,
          teacherName,
        };
        if (idx >= 0) prev[idx] = newEntry;
        else prev.push(newEntry);

        studentUpdates.set(found.id, prev);
      }

      // 실제 업데이트 수행
      await Promise.all(
        Array.from(studentUpdates.entries()).map(([id, history]) =>
          updateStudent(school, id, { schoolHistory: history })
        )
      );
      onStudentsUpdate();
      toast({
        title: "📅 과거 이력 등록 완료",
        description: `${matched}건 이력 저장, ${notFound}건 학생 미매칭 (이름 확인 필요)`,
      });
    } catch {
      toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일 형식이 올바르지 않습니다." });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  // ── 렌더링 ───────────────────────────────────────────────

  if (!school) {
    return (
        <Card className="bg-transparent shadow-none border-none px-0">
            <CardHeader className="px-0">
                <Skeleton className="h-8 w-40 mb-2" />
                <Skeleton className="h-4 w-60" />
            </CardHeader>
            <CardContent className="px-0 space-y-6">
                <div className="flex justify-between items-center">
                    <div className="flex gap-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
                    <Skeleton className="h-10 w-48" />
                </div>
                <div className="border rounded-xl overflow-hidden bg-muted/20">
                    <div className="bg-muted/30 p-4"><Skeleton className="h-6 w-full" /></div>
                    {[1,2,3,4,5].map(i => (
                        <div key={i} className="p-4 flex items-center gap-4 border-t border-muted/30">
                            <Skeleton className="h-5 w-5" /><Skeleton className="h-14 w-14 rounded-full" />
                            <Skeleton className="h-4 flex-1" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card className="bg-transparent shadow-none border-none w-full max-w-full">
      <CardHeader className="px-0 sm:px-6 py-1 sm:py-3">
        <CardTitle className="text-base sm:text-xl font-bold truncate">학생 관리</CardTitle>
        <CardDescription className="text-[11px] sm:text-xs text-muted-foreground truncate">학생을 개별 또는 일괄 등록하고 관리합니다.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 sm:px-6 py-1 sm:py-3">

        {/* 상단 액션 바 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 w-full md:w-auto">

            {/* 개별 학생 추가 */}
            <AddStudentDialog onAddStudent={handleAddStudent} school={school || ''} />

            {/* ── 일괄 등록 드롭다운 ── */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 sm:h-8 text-[11px] sm:text-xs px-2 sm:px-2.5" disabled={isUploading}>
                  {isUploading
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> 등록 중...</>
                    : <><FileUp className="mr-1.5 h-3.5 w-3.5" /> 일괄 등록 <ChevronDown className="ml-1 h-3 w-3" /></>
                  }
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">업로드 유형 선택</DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* 1. 기본 명부 등록 */}
                <DropdownMenuItem
                  className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                  onClick={() => basicInputRef.current?.click()}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4 text-blue-500" />
                    기본 명부 등록
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    학년 · 반 · 번호 · 이름 · 성별 · 개인코드
                  </span>
                </DropdownMenuItem>

                {/* 2. 건강기록부 통합 등록 */}
                <DropdownMenuItem
                  className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                  onClick={() => healthInputRef.current?.click()}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <Stethoscope className="h-4 w-4 text-green-500" />
                    건강기록부 통합 등록
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    기본 + 주민등록번호 · 보호자명 · 혈액형 등
                  </span>
                </DropdownMenuItem>

                {/* 3. 과거 학년도 이력 등록 */}
                <DropdownMenuItem
                  className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                  onClick={() => historyInputRef.current?.click()}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <History className="h-4 w-4 text-orange-500" />
                    과거 학년도 이력 등록
                  </div>
                  <span className="text-xs text-muted-foreground pl-6">
                    학년도 · 학년 · 반 · 번호 · 이름 · 담임성명
                  </span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">양식 다운로드</DropdownMenuLabel>

                <DropdownMenuItem className="text-xs cursor-pointer" onClick={downloadBasicTemplate}>
                  📋 기본 명부 양식 (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={downloadHealthTemplate}>
                  🏥 건강기록부 통합 양식 (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs cursor-pointer" onClick={downloadHistoryTemplate}>
                  📅 과거 이력 등록 양식 (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 숨겨진 File Inputs */}
            <input ref={basicInputRef}   type="file" accept=".xlsx" onChange={handleBasicUpload}   style={{ display: "none" }} />
            <input ref={healthInputRef}  type="file" accept=".xlsx" onChange={handleHealthUpload}  style={{ display: "none" }} />
            <input ref={historyInputRef} type="file" accept=".xlsx" onChange={handleHistoryUpload} style={{ display: "none" }} />

            <BatchPhotoUploadDialog students={sortedStudents} onComplete={onStudentsUpdate} school={school || ''} />

            {/* 검색 */}
            <div className="relative w-full sm:w-44 lg:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="학생 이름 검색..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 sm:h-8 text-[11px] sm:text-xs"
              />
            </div>
          </div>

          {/* 우측: 필터 + 다운로드 + 삭제 */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 w-full md:w-auto justify-start md:justify-end">
            <div className="flex items-center gap-1">
              <Select value={selectedGrade} onValueChange={(v) => { setSelectedGrade(v); setSelectedClassNum("all"); }}>
                <SelectTrigger className="w-[68px] sm:w-[85px] h-7 sm:h-8 text-[11px] sm:text-xs"><SelectValue placeholder="학년" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 학년</SelectItem>
                  {grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={selectedGrade === "all"}>
                <SelectTrigger className="w-[58px] sm:w-[75px] h-7 sm:h-8 text-[11px] sm:text-xs"><SelectValue placeholder="반" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 반</SelectItem>
                  {selectedGrade !== "all" && classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 명단 다운로드 드롭다운 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="h-7 sm:h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs">
                  <FileDown className="mr-1 h-3.5 w-3.5" /> <span className="hidden sm:inline">명단 다운로드</span><span className="sm:hidden">다운</span> <ChevronDown className="ml-0.5 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadList} className="text-xs">
                  <Users className="mr-2 h-4 w-4 text-blue-500" />
                  기본 명단 (체육 기록용)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadHealthList} className="text-xs">
                  <Stethoscope className="mr-2 h-4 w-4 text-green-500" />
                  건강기록부 통합 명단
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 삭제 */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 sm:h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs"
                  disabled={selectedIds.length === 0 || isProcessing}
                >
                  {isProcessing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                  삭제 ({selectedIds.length})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle><AlertDialogDescription>선택한 학생들과 관련 기록이 영구 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSelected}>삭제</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* 학생 목록 테이블 */}
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="w-8 sm:w-10 text-center p-1"><Checkbox checked={sortedStudents.length > 0 && selectedIds.length === sortedStudents.length} onCheckedChange={(c) => {
                  const newSelection: Record<string, boolean> = {};
                  if (c) sortedStudents.forEach(s => newSelection[s.id] = true);
                  setSelection(newSelection);
                }} /></TableHead>
                <TableHead className="w-14 sm:w-16 text-center p-1 text-[11px] sm:text-xs font-bold">사진</TableHead>
                <TableHead className="p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">학생 정보</TableHead>
                <TableHead className="w-16 sm:w-20 text-center p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">접속 코드</TableHead>
                <TableHead className="w-16 sm:w-20 text-center p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">건강기록부</TableHead>
                <TableHead className="w-14 sm:w-18 text-center p-1 text-[11px] sm:text-xs font-bold whitespace-nowrap">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.length > 0 ? sortedStudents.map((student) => (
                <TableRow key={student.id} className="h-14 sm:h-16">
                  <TableCell className="p-1 text-center"><Checkbox checked={selection[student.id] || false} onCheckedChange={(c) => setSelection(prev => ({...prev, [student.id]: !!c}))} /></TableCell>
                  <TableCell className="p-1 text-center">
                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-lg shadow-sm border border-border/50">
                      <AvatarImage src={student.photoUrl} className="object-cover" />
                      <AvatarFallback className="text-xs font-bold bg-muted">{student.name[0]}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="p-1 whitespace-nowrap">
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm leading-tight whitespace-nowrap">{student.name}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", student.gender === '남' ? 'text-blue-600 border-blue-200' : 'text-pink-600 border-pink-200')}>
                          {student.gender}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-tight mt-0.5">
                        {student.grade}학년 {student.classNum}반 {student.studentNum}번
                        {student.personalCode && <span className="ml-1 text-primary">· {student.personalCode}</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <span className="font-mono text-xs font-semibold bg-muted/60 px-1.5 py-0.5 rounded text-foreground">
                      {student.accessCode}
                    </span>
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    {student.residentRegistrationNumber
                      ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">등록됨</Badge>
                      : <span className="text-muted-foreground text-[10px]">-</span>
                    }
                  </TableCell>
                  <TableCell className="p-1 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => setEditingStudent(student)} title="정보 수정">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <PhotoEditDialog student={student} onUpdatePhoto={handleUpdatePhoto} />
                    </div>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={6} className="h-20 text-center text-xs text-muted-foreground">등록된 학생이 없습니다.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {editingStudent && (
          <EditStudentDialog 
            student={editingStudent} 
            onUpdateStudent={handleUpdateStudent} 
            open={!!editingStudent}
            onOpenChange={(open: boolean) => !open && setEditingStudent(null)}
          />
      )}
    </Card>
  );
}
