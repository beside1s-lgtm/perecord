
'use client';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Loader2 } from "lucide-react";
import type { Student, StudentToUpdate } from "@/lib/types";


export function EditStudentDialog({ 
  student, 
  onUpdateStudent, 
  open, 
  onOpenChange 
}: { 
  student: Student; 
  onUpdateStudent: (data: Partial<Omit<Student, "school" | "id" | "accessCode">>) => Promise<void>; 
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<Partial<Omit<Student, "school" | "id" | "accessCode">>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (student && open) {
        setForm({ 
            grade: student.grade, 
            classNum: student.classNum, 
            studentNum: student.studentNum, 
            name: student.name, 
            gender: student.gender,
            residentRegistrationNumber: student.residentRegistrationNumber || "",
            guardianName: student.guardianName || "",
            bloodType: student.bloodType || "",
            officialSchoolName: student.officialSchoolName || "",
            teacherName: student.teacherName || ""
        });
    }
  }, [student, open]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onUpdateStudent(form);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>학생 정보 수정</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">학년 *</Label><Input value={form.grade || ''} onChange={e => setForm({...form, grade: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">반 *</Label><Input value={form.classNum || ''} onChange={e => setForm({...form, classNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">번호 *</Label><Input value={form.studentNum || ''} onChange={e => setForm({...form, studentNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">이름 *</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">성별 *</Label>
            <Select onValueChange={v => setForm({...form, gender: v as "남" | "여"})} value={form.gender}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="남">남</SelectItem><SelectItem value="여">여</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">주민등록번호</Label><Input placeholder="예: 141128-3409628" value={form.residentRegistrationNumber || ''} onChange={e => setForm({...form, residentRegistrationNumber: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">보호자명</Label><Input value={form.guardianName || ''} onChange={e => setForm({...form, guardianName: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">혈액형</Label><Input placeholder="예: A(+)" value={form.bloodType || ''} onChange={e => setForm({...form, bloodType: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">정식학교명</Label><Input value={form.officialSchoolName || ''} onChange={e => setForm({...form, officialSchoolName: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">담임교사명</Label><Input value={form.teacherName || ''} onChange={e => setForm({...form, teacherName: e.target.value})} className="col-span-3" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
