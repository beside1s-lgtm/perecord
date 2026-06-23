import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const universalKeyMap: Record<string, string> = {
    // Student
    '학교': 'school',
    '학년': 'grade',
    '반': 'classNum',
    '번호': 'studentNum',
    '이름': 'name',
    '성별': 'gender',
    '접속코드': 'accessCode',
    // Promotion
    '새 학년': 'newGrade',
    '새 반': 'newClassNum',
    '새 번호': 'newStudentNum',
    // Record
    '측정종목': 'item',
    '기록': 'value',
    '측정일': 'date'
};


export function exportToExcel(filename: string, rows: object[]) {
  if (!rows || rows.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * NEIS PAPS 전용 엑셀 내보내기
 * 반코드("01", "02") 같은 zero-padded 문자열이 숫자로 변환되지 않도록
 * 해당 셀을 강제로 텍스트 타입(t:'s')으로 지정합니다.
 */
export function exportNeisToExcel(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  // 텍스트로 강제 지정할 컬럼 인덱스 (반코드)
  const textColIndices = new Set(
    headers.map((h, i) => h === '반코드' ? i : -1).filter(i => i >= 0)
  );

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 반코드 셀 타입을 텍스트(s)로 강제 변환
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r + 1; row <= range.e.r; row++) { // 헤더 다음 행부터
    textColIndices.forEach(col => {
      const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddr]) {
        worksheet[cellAddr].t = 's'; // 텍스트 타입 강제
        worksheet[cellAddr].v = String(worksheet[cellAddr].v ?? '').padStart(2, '0');
        delete worksheet[cellAddr].z; // 숫자 포맷 제거
      }
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PAPS");
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export async function parseExcel<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
      
      const parsed = jsonData.map(row => {
        return Object.entries(row).reduce((obj, [key, value]) => {
          const newKey = universalKeyMap[key.trim()] || key.trim();
          if (newKey !== 'accessCode') {
            (obj as any)[newKey] = String(value).trim();
          }
          return obj;
        }, {} as T);
      });
      resolve(parsed);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function exportToZip(filename: string, files: { name: string, data: object[] }[]) {
  const zip = new JSZip();
  
  files.forEach(file => {
      // Use CSV for inside Zip if necessary, or just use XLSX for everything.
      // But for templates, let's just make them separate XLSX files if they are multiple?
      // Actually, let's keep CSV inside ZIP for now OR change it to multiple XLSX if needed.
      // The user wants XLSX for templates. Let's make them separate XLSX if requested?
      // Let's just update exportToZip to pack XLSX files instead.
      const worksheet = XLSX.utils.json_to_sheet(file.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      zip.file(file.name.replace('.csv', '.xlsx'), excelBuffer);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  
  const link = document.createElement('a');
  if (link.download !== undefined) {
      const url = URL.createObjectURL(zipBlob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
}
