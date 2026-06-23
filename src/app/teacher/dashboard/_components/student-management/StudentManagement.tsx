'use client';
import { useState, useMemo, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { parseExcel } from "@/lib/utils";
import {
  UserPlus,
  Trash2,
  FileUp,
  FileDown,
  Loader2,
  Pencil,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddStudentDialog } from "./AddStudentDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { PhotoEditDialog } from "./PhotoEditDialog";
import { BatchPhotoUploadDialog } from "./BatchPhotoUploadDialog";

interface StudentManagementProps {
  students: Student[];
  onStudentsUpdate: () => void;
}

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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
    return filtered;
  }, [students, selectedGrade, selectedClassNum]);

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

  const handleAddStudent = async (studentData: StudentToAdd) => {
    if (!school) return;
    await addStudent(school, studentData, students);
    onStudentsUpdate(); 
    toast({ title: "학생 추가 완료", description: `${studentData.name} 학생을 등록했습니다.` });
  };
  
  const handleUpdateStudent = async (studentData: StudentToUpdate) => {
    if (!school || !selectedStudentForEdit) return;
    await updateStudent(school, selectedStudentForEdit.id, studentData);
    setSelection({});
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
      '접속코드': s.accessCode,
    }));
    
    exportToExcel(`${school}_${label}_명단.xlsx`, dataToExport);
    toast({
      title: "다운로드 시작",
      description: `${label.replace(/_/g, ' ')} 명단을 다운로드합니다.`,
    });
  };

  const handleStudentExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && school) {
      setIsUploading(true);
      try {
        const newStudents = await parseExcel<Omit<Student, "id" | "accessCode" | "photoUrl">>(file);
        let count = 0;
        await Promise.all(newStudents.map((s: any) => {
          const studentSchool = s.school || school;
          const exists = students.some(st => st.grade === s.grade && st.classNum === s.classNum && st.studentNum === s.studentNum && st.name === s.name);
          if (!exists) {
            count++;
            return addStudent(studentSchool, { ...s, school: studentSchool }, students);
          }
          return Promise.resolve();
        }));
        onStudentsUpdate();
        toast({ title: "일괄 등록 완료", description: `${count}명의 학생을 등록했습니다.` });
      } catch (err) {
        toast({ variant: "destructive", title: "파일 오류", description: "엑셀 파일의 형식이 올바르지 않습니다." });
      } finally { setIsUploading(false); }
    }
    event.target.value = ""; 
  };

  return (
    <Card className="bg-transparent shadow-none border-none">
      <CardHeader>
        <CardTitle>학생 관리</CardTitle>
        <CardDescription>학생을 개별 또는 일괄 등록하고 관리합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          {/* Action Group */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <AddStudentDialog onAddStudent={handleAddStudent} school={school || ''} />
            {selectedStudentForEdit && (
              <>
                <Button variant="outline" size="sm" className="h-9" onClick={() => setIsEditDialogOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> 정보 수정
                </Button>
                <EditStudentDialog 
                  student={selectedStudentForEdit} 
                  onUpdateStudent={handleUpdateStudent} 
                  open={isEditDialogOpen} 
                  onOpenChange={setIsEditDialogOpen} 
                />
              </>
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={() => document.getElementById("student-excel-upload")?.click()} disabled={isUploading}>
              {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중...</> : <><FileUp className="mr-2 h-4 w-4" /> 일괄 등록</>}
            </Button>
            <input type="file" id="student-excel-upload" accept=".xlsx" onChange={handleStudentExcelUpload} style={{ display: "none" }} />
            <BatchPhotoUploadDialog students={sortedStudents} onComplete={onStudentsUpdate} school={school || ''} />
          </div>

          {/* Filter & Utility Group */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            <div className="flex items-center gap-2">
              <Select value={selectedGrade} onValueChange={(v) => { setSelectedGrade(v); setSelectedClassNum("all"); }}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="학년" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 학년</SelectItem>
                  {grades.map(g => <SelectItem key={g} value={g}>{g}학년</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedClassNum} onValueChange={setSelectedClassNum} disabled={selectedGrade === "all"}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="반" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 반</SelectItem>
                  {selectedGrade !== "all" && classNumsByGrade[selectedGrade]?.map(c => <SelectItem key={c} value={c}>{c}반</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="h-9 px-3" onClick={handleDownloadList}>
                <FileDown className="mr-2 h-4 w-4" /> 명단 받기
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9 px-3"
                    disabled={selectedIds.length === 0 || isProcessing}
                  >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
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
        </div>

        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"><Checkbox checked={sortedStudents.length > 0 && selectedIds.length === sortedStudents.length} onCheckedChange={(c) => {
                  const newSelection: Record<string, boolean> = {};
                  if (c) sortedStudents.forEach(s => newSelection[s.id] = true);
                  setSelection(newSelection);
                }} /></TableHead>
                <TableHead>사진</TableHead><TableHead>학년</TableHead><TableHead>반</TableHead><TableHead>번호</TableHead><TableHead>이름</TableHead><TableHead>성별</TableHead><TableHead>접속 코드</TableHead><TableHead className="text-right">사진 관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.length > 0 ? sortedStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell><Checkbox checked={selection[student.id] || false} onCheckedChange={(c) => setSelection(prev => ({...prev, [student.id]: !!c}))} /></TableCell>
                  <TableCell><Avatar className="w-20 h-20"><AvatarImage src={student.photoUrl} /><AvatarFallback>{student.name[0]}</AvatarFallback></Avatar></TableCell>
                  <TableCell>{student.grade}</TableCell><TableCell>{student.classNum}</TableCell><TableCell>{student.studentNum}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell><TableCell>{student.gender}</TableCell><TableCell>{student.accessCode}</TableCell>
                  <TableCell className="text-right"><PhotoEditDialog student={student} onUpdatePhoto={handleUpdatePhoto} /></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={9} className="h-24 text-center">등록된 학생이 없습니다.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
