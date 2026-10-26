
'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { exportToExcel, getQuizResultsBySchool, getQuizAssignments, deleteRecordsByDateAndItem, getSchoolByName } from '@/lib/store';
import type { Student, MeasurementItem, MeasurementRecord, QuizResult, QuizAssignment, SportsClub, MeasurementPeriod } from '@/lib/types';
import { getPapsGrade, calculatePapsScore, getCustomItemGrade } from '@/lib/paps';
import { calculateRanks } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FileDown, Calendar as CalendarIcon, BookOpen, Trash2, Loader2, Filter, ArrowUp, ArrowDown, RotateCcw, Search, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface RecordBrowserProps {
  allStudents: Student[];
  allItems: MeasurementItem[];
  allRecords: MeasurementRecord[];
  sportsClubs: SportsClub[];
}

type ViewType = 'grade' | 'score' | 'record';
type SortDescriptor = {
  column: string;
  direction: 'ascending' | 'descending';
};


const papsFactors: Record<string, string> = {
    '왕복오래달리기': '심폐지구력',
    '오래달리기': '심폐지구력',
    '윗몸 말아올리기': '근력/근지구력',
    '팔굽혀펴기': '근력/근지구력',
    '무릎 대고 팔굽혀펴기': '근력/근지구력',
    '악력': '근력/근지구력',
    '앉아윗몸앞으로굽히기': '유연성',
    '50m 달리기': '순발력',
    '제자리 멀리뛰기': '순발력',
    '체질량지수(BMI)': '체질량지수(BMI)',
};

const factorOrder = ['학년', '반', '번호', '이름', '성별', '심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)', '종합'];


export default function RecordBrowser({
  allStudents,
  allItems,
  allRecords,
  sportsClubs,
}: RecordBrowserProps) {
  const { toast } = useToast();
  const { school } = useAuth();

  const [gradeFilter, setGradeFilter] = useState('all');
  const [classNumFilter, setClassNumFilter] = useState('all');
  const [selectedClubId, setSelectedClubId] = useState('all');
  const [dateFilter, setDateFilter] = useState<Date | 'latest' | undefined>('latest');
  const [viewType, setViewType] = useState<ViewType>('grade');
  
  const [papsSort, setPapsSort] = useState<SortDescriptor[]>([
    { column: '학년', direction: 'ascending'},
    { column: '반', direction: 'ascending'},
    { column: '번호', direction: 'ascending'}
  ]);


  const [selectedItem, setSelectedItem] = useState('');
  const [itemGradeFilter, setItemGradeFilter] = useState('all');
  const [itemClassNumFilter, setItemClassNumFilter] = useState('all');
  const [itemDateFilter, setItemDateFilter] = useState('latest');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 엑셀 스타일 컬럼별 선택 필터 상태: { [columnKey]: string[] (선택된 값들) }
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [columnSearchTerm, setColumnSearchTerm] = useState<Record<string, string>>({});

  const clearAllFilters = () => {
    setColumnFilters({});
  };

  const isAnyFilterActive = useMemo(() => {
    return Object.values(columnFilters).some(arr => arr && arr.length > 0);
  }, [columnFilters]);

  const [itemSort, setItemSort] = useState<SortDescriptor[]>([
    { column: 'grade', direction: 'ascending' },
    { column: 'classNum', direction: 'ascending' },
    { column: 'studentNum', direction: 'ascending' }
  ]);
  
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizAssignments, setQuizAssignments] = useState<QuizAssignment[]>([]);
  const [measurementPeriods, setMeasurementPeriods] = useState<MeasurementPeriod[]>([]);

  useEffect(() => {
    if (school) {
      getSchoolByName(school).then(s => {
        if (s?.measurementPeriods) {
          setMeasurementPeriods(s.measurementPeriods);
        }
      });
    }
  }, [school]);

  // Filter for items that actually have at least one record, grouped by category
  const { groupedItemsWithRecords, totalRecordedItemsCount } = useMemo(() => {
    const recordedItemNames = new Set(allRecords.map(r => r.item));
    const items = allItems.filter(item => recordedItemNames.has(item.name));
    
    const papsItems = items
      .filter(i => i.isPaps)
      .sort((a, b) => a.name.localeCompare(b.name));
      
    const nonPapsItems = items.filter(i => !i.isPaps);
    const categoryMap = new Map<string, MeasurementItem[]>();
    
    nonPapsItems.forEach(item => {
      const cat = item.category?.trim() || '기타 종목';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(item);
    });

    const sportsGroups: { category: string; items: MeasurementItem[] }[] = [];
    Array.from(categoryMap.entries())
      .sort(([catA], [catB]) => catA.localeCompare(catB))
      .forEach(([category, catItems]) => {
        sportsGroups.push({
          category,
          items: catItems.sort((a, b) => a.name.localeCompare(b.name))
        });
      });

    return {
      groupedItemsWithRecords: {
        paps: papsItems,
        sports: sportsGroups,
      },
      totalRecordedItemsCount: items.length
    };
  }, [allItems, allRecords]);

  useEffect(() => {
    if (school && selectedItem === 'theory-exam') {
        Promise.all([
            getQuizResultsBySchool(school),
            getQuizAssignments(school)
        ]).then(([results, assignments]) => {
            setQuizResults(results);
            setQuizAssignments(assignments);
        });
    }
  }, [school, selectedItem]);


  const { grades, classNumsByGrade, availableDates } = useMemo(() => {
    const grades = [...new Set(allStudents.map((s) => s.grade))].sort((a,b) => parseInt(a) - parseInt(b));
    const classNumsByGrade: Record<string, string[]> = {};
    grades.forEach((grade) => {
      classNumsByGrade[grade] = [
        ...new Set(
          allStudents.filter((s) => s.grade === grade).map((s) => s.classNum)
        ),
      ].sort((a,b) => parseInt(a) - parseInt(b));
    });
    const dates = [...new Set(allRecords.map(r => r.date))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { grades, classNumsByGrade, availableDates: dates };
  }, [allStudents, allRecords]);
  
  const selectedItemInfo = useMemo(() => allItems.find(i => i.name === selectedItem), [selectedItem, allItems]);

  const studentPapsTableData = useMemo(() => {
    let filteredStudents = allStudents;
    
    if (selectedClubId !== 'all') {
      const club = sportsClubs.find(c => c.id === selectedClubId);
      if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
    } else if (gradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === gradeFilter);
      if (classNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === classNumFilter);
      }
    }
    
    return filteredStudents.map(student => {
      const studentData: Record<string, any> = {
        '학년': student.grade,
        '반': student.classNum,
        '번호': student.studentNum,
        '이름': student.name,
        '성별': student.gender,
      };

      const studentRecords = allRecords.filter(r => r.studentId === student.id);
      let totalPapsScore = 0;
      let scoredFactorCount = 0;
      
      const papsFactorKeys = ['심폐지구력', '유연성', '근력/근지구력', '순발력', '체질량지수(BMI)'];

      papsFactorKeys.forEach(factor => {
        const factorItems = Object.keys(papsFactors).filter(key => papsFactors[key] === factor);
        let latestRecord: MeasurementRecord | undefined;
        let latestItem: MeasurementItem | undefined;
        
        for(const itemName of factorItems) {
            const item = allItems.find(i => i.name === itemName);
            if (!item) continue;

            const recordsForItem = studentRecords.filter(r => {
                if (r.item !== itemName) return false;
                if (dateFilter === 'latest') return true;
                return dateFilter && r.date === format(dateFilter, 'yyyy-MM-dd');
            });

            if (recordsForItem.length > 0) {
              const currentLatest = recordsForItem.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              if (!latestRecord || new Date(currentLatest.date) > new Date(latestRecord.date)) {
                  latestRecord = currentLatest;
                  latestItem = item;
              }
            }
        }
        
        if (latestRecord && latestItem) {
            const grade = getPapsGrade(latestRecord.item, student, latestRecord.value);
            const score = calculatePapsScore(latestRecord.item, student, latestRecord.value);
            
            if(viewType === 'grade') {
                studentData[factor] = grade ? `${grade}등급` : 'N/A';
            } else if (viewType === 'score') {
                studentData[factor] = score !== null ? score : 'N/A';
            } else { // 'record'
                studentData[factor] = `${latestRecord.value}${latestItem.unit}`;
            }

            if (score !== null && factor !== '체질량지수(BMI)') {
                totalPapsScore += score;
                scoredFactorCount++;
            }
        } else {
            studentData[factor] = '-';
        }
      });
      
      let finalGrade = '-';
      let finalScore = 0;

      if (scoredFactorCount > 0) {
        finalScore = (totalPapsScore / (scoredFactorCount * 20)) * 100;
        
        if (finalScore >= 80) finalGrade = '1등급';
        else if (finalScore >= 60) finalGrade = '2등급';
        else if (finalScore >= 40) finalGrade = '3등급';
        else if (finalScore >= 20) finalGrade = '4등급';
        else finalGrade = '5등급';
      }

      if(viewType === 'grade') {
        studentData['종합'] = finalGrade;
      } else if (viewType === 'score') {
        studentData['종합'] = scoredFactorCount > 0 ? Math.round(finalScore) : 'N/A';
      } else { // 'record'
        studentData['종합'] = finalGrade;
      }
      
      return studentData;
    });
  }, [allStudents, allRecords, allItems, gradeFilter, classNumFilter, selectedClubId, sportsClubs, dateFilter, viewType]);

  const sortedPapsData = useMemo(() => {
    if (!papsSort.length) return studentPapsTableData;
    
    return [...studentPapsTableData].sort((a, b) => {
        for (const sort of papsSort) {
            const { column, direction } = sort;
            const valA = a[column];
            const valB = b[column];
            const isAsc = direction === 'ascending';
            
            const numA = parseFloat(String(valA));
            const numB = parseFloat(String(valB));

            let comparison = 0;
            if (!isNaN(numA) && !isNaN(numB)) {
                comparison = numA - numB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
    });
  }, [studentPapsTableData, papsSort]);
  

  const handlePapsDownloadExcel = () => {
    if (sortedPapsData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    
    const fileName = `PAPS_종합_현황_${viewType}_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportToExcel(fileName, sortedPapsData);
    toast({
      title: '다운로드 시작',
      description: 'PAPS 종합 체력 현황을 엑셀 파일로 다운로드합니다.',
    });
  };

  const finalFactorOrder = useMemo(() => {
    const newOrder = [...factorOrder];
    const 종합Index = newOrder.indexOf('종합');
    if (종합Index !== -1) {
        newOrder[종합Index] = viewType === 'score' ? '종합점수' : '종합등급';
    }
    return newOrder;
  }, [viewType]);


  // 현재 선택된 항목이 기간 종합 평가인지 확인
  const selectedPeriodEval = useMemo(() => {
    if (!selectedItem.startsWith('period-eval:')) return null;
    const periodId = selectedItem.replace('period-eval:', '');
    return measurementPeriods.find(p => p.id === periodId) || null;
  }, [selectedItem, measurementPeriods]);

  const studentItemTableData = useMemo(() => {
    if (!selectedItem || !school) return [];

    // 1. 기간 종합 평가 (예: 피클볼 평가 - 서브 + 딩크)
    if (selectedPeriodEval) {
      let filteredStudents = allStudents;
      if (selectedClubId !== 'all') {
        const club = sportsClubs.find(c => c.id === selectedClubId);
        if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
      } else if (itemGradeFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
        if (itemClassNumFilter !== 'all') {
          filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
        }
      }

      if (filteredStudents.length === 0) return [];

      const targetItemNames = (selectedPeriodEval.criteria?.itemNames && selectedPeriodEval.criteria.itemNames.length > 0)
        ? selectedPeriodEval.criteria.itemNames
        : (selectedPeriodEval.itemNames && selectedPeriodEval.itemNames.length > 0
            ? selectedPeriodEval.itemNames
            : allItems.filter(i => i.isMeasurementWeek && !i.isArchived && !i.isDeactivated).map(i => i.name));

      const highMin = selectedPeriodEval.criteria?.highMin ?? 8;
      const midMin = selectedPeriodEval.criteria?.midMin ?? 5;

      // 전체 학생 기준 합산 점수 및 랭킹 산출
      const scoresWithStudents = allStudents.map(student => {
        let studentRecords = allRecords.filter(r => r.studentId === student.id && targetItemNames.includes(r.item));
        if (itemDateFilter !== 'latest' && itemDateFilter !== 'all') {
          studentRecords = studentRecords.filter(r => r.date === itemDateFilter);
        }

        let totalScore = 0;
        let recordedItemCount = 0;
        let latestDate: string | null = null;
        const itemScores: Record<string, number | null> = {};

        targetItemNames.forEach(itemName => {
          const itemRecs = studentRecords.filter(r => r.item === itemName);
          if (itemRecs.length > 0) {
            const bestOrLatest = itemDateFilter === 'latest'
              ? itemRecs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
              : itemRecs[0];
            const numVal = parseFloat(String(bestOrLatest.value)) || 0;
            totalScore += numVal;
            recordedItemCount++;
            itemScores[itemName] = numVal;
            if (!latestDate || new Date(bestOrLatest.date).getTime() > new Date(latestDate).getTime()) {
              latestDate = bestOrLatest.date;
            }
          } else {
            itemScores[itemName] = null;
          }
        });

        const hasAnyRecord = recordedItemCount > 0;
        let evalGrade = '-';
        if (hasAnyRecord) {
          if (totalScore >= highMin) evalGrade = '잘함';
          else if (totalScore >= midMin) evalGrade = '보통';
          else evalGrade = '노력요함';
        }

        return {
          studentId: student.id,
          grade: student.grade,
          totalScore: hasAnyRecord ? totalScore : null,
          hasAnyRecord,
          itemScores,
          latestDate,
          evalGrade
        };
      });

      // 랭킹 산출 (동점자 동일 순위)
      const rankFilterGrade = itemGradeFilter === 'all' ? undefined : itemGradeFilter;
      const rankedPool = scoresWithStudents
        .filter(s => s.hasAnyRecord && (rankFilterGrade ? s.grade === rankFilterGrade : true))
        .sort((a, b) => (b.totalScore ?? -999) - (a.totalScore ?? -999));

      const rankMap = new Map();
      let curRank = 1;
      rankedPool.forEach((item, index) => {
        if (index > 0 && item.totalScore !== rankedPool[index - 1].totalScore) {
          curRank = index + 1;
        }
        rankMap.set(item.studentId, curRank);
      });

      return filteredStudents.map(student => {
        const stat = scoresWithStudents.find(s => s.studentId === student.id);
        const rank = stat?.studentId ? rankMap.get(stat.studentId) : null;

        return {
          ...student,
          latestDate: stat?.latestDate || null,
          value: stat?.totalScore !== null && stat?.totalScore !== undefined ? stat.totalScore : null,
          recordGrade: stat?.evalGrade !== '-' ? stat?.evalGrade : null,
          evalGrade: stat?.evalGrade || '-',
          itemScores: stat?.itemScores || {},
          targetItemNames,
          rank: rank || null,
          totalRanked: rankedPool.length,
          quizTitle: null,
          score: null,
          passed: null
        };
      });
    }

    if (selectedItem === 'theory-exam') {
        let filteredStudents = allStudents;
        if (selectedClubId !== 'all') {
            const club = sportsClubs.find(c => c.id === selectedClubId);
            if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
        } else if (itemGradeFilter !== 'all') {
            filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
            if (itemClassNumFilter !== 'all') {
                filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
            }
        }

        return filteredStudents.flatMap(student => {
            const results = quizResults.filter(r => r.studentId === student.id);
            if (results.length === 0) {
                return [{
                    ...student,
                    quizTitle: '-',
                    score: '-',
                    recordGrade: null,
                    evalGrade: null,
                    itemScores: {},
                    targetItemNames: [],
                    passed: false,
                    latestDate: '-',
                    rank: null,
                    value: null,
                    totalRanked: 0
                }];
            }
            return results.map(r => {
                const assignment = quizAssignments.find(a => a.id === r.assignmentId);
                return {
                    ...student,
                    quizTitle: assignment?.quizTitle || '알 수 없는 퀴즈',
                    score: `${r.score} / ${r.total}`,
                    recordGrade: null,
                    evalGrade: null,
                    itemScores: {},
                    targetItemNames: [],
                    passed: r.passed,
                    latestDate: r.createdAt?.toDate ? format(r.createdAt.toDate(), 'yyyy-MM-dd') : '-',
                    rank: null,
                    value: null,
                    totalRanked: 0
                };
            });
        });
    }

    const itemInfo = allItems.find(i => i.name === selectedItem);
    if (!itemInfo) return [];

    let filteredStudents = allStudents;
    if (selectedClubId !== 'all') {
      const club = sportsClubs.find(c => c.id === selectedClubId);
      if (club) filteredStudents = filteredStudents.filter(s => club.memberIds.includes(s.id));
    } else if (itemGradeFilter !== 'all') {
      filteredStudents = filteredStudents.filter(s => s.grade === itemGradeFilter);
      if (itemClassNumFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.classNum === itemClassNumFilter);
      }
    }

    if (filteredStudents.length === 0) {
        return [];
    }

    const allRanks = calculateRanks(school, allItems, allRecords, allStudents, itemGradeFilter === 'all' ? undefined : itemGradeFilter);
    const itemRanks = allRanks[selectedItem] || [];

    return filteredStudents.map(student => {
      let records = allRecords.filter(r => r.studentId === student.id && r.item === selectedItem);
      
      if (itemDateFilter !== 'latest' && itemDateFilter !== 'all') {
        records = records.filter(r => r.date === itemDateFilter);
      }

      const latestRecord = records.length > 0
        ? (itemDateFilter === 'latest' 
           ? records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
           : records[0])
        : null;
      
      const rankInfo = latestRecord ? itemRanks.find(r => r.studentId === student.id && r.value === latestRecord.value) : null;
      
      let recordGrade: number | null = null;
      if (latestRecord) {
        if (itemInfo.isPaps) {
          recordGrade = getPapsGrade(itemInfo.name, student, latestRecord.value);
        } else {
          recordGrade = getCustomItemGrade(itemInfo, latestRecord.value);
        }
      }

      return {
        ...student,
        latestDate: latestRecord?.date || null,
        value: latestRecord?.value,
        height: latestRecord?.height,
        weight: latestRecord?.weight,
        recordGrade, 
        evalGrade: null,
        itemScores: {},
        targetItemNames: [],
        rank: rankInfo ? rankInfo.rank : null,
        totalRanked: itemRanks.length,
        quizTitle: null,
        score: null,
        passed: null
      };
    });

  }, [school, selectedItem, itemGradeFilter, itemClassNumFilter, itemDateFilter, allStudents, allRecords, allItems, quizResults, quizAssignments, selectedPeriodEval, measurementPeriods]);

  // 1단계: 엑셀 스타일 컬럼별 필터 적용
  const filteredItemData = useMemo(() => {
    if (!Object.keys(columnFilters).length) return studentItemTableData;

    return studentItemTableData.filter(student => {
      for (const [colKey, selectedValues] of Object.entries(columnFilters)) {
        if (!selectedValues || selectedValues.length === 0) continue;

        let rawVal = '';
        if (colKey === 'name') rawVal = student.name;
        else if (colKey === 'grade') rawVal = `${student.grade}학년`;
        else if (colKey === 'classNum') rawVal = `${student.classNum}반`;
        else if (colKey === 'studentNum') rawVal = `${student.studentNum}번`;
        else if (colKey === 'latestDate') rawVal = (student as any).latestDate || '-';
        else if (colKey === 'value') {
          rawVal = (student as any).value !== null && (student as any).value !== undefined
            ? (selectedPeriodEval ? `${(student as any).value}점` : `${(student as any).value}${selectedItemInfo?.unit || ''}`)
            : '-';
        }
        else if (colKey === 'evalGrade') rawVal = (student as any).evalGrade || '-';
        else if (colKey === 'recordGrade') rawVal = (student as any).recordGrade ? `${(student as any).recordGrade}등급` : '-';
        else if (colKey.startsWith('sub_')) {
          const subName = colKey.replace('sub_', '');
          const score = (student as any).itemScores?.[subName];
          rawVal = score !== null && score !== undefined ? `${score}개` : '-';
        }
        else if (colKey === 'rank') {
          rawVal = (student as any).rank ? `${(student as any).rank}등` : '-';
        }
        else if (colKey === 'quizTitle') rawVal = (student as any).quizTitle || '-';
        else if (colKey === 'score') rawVal = (student as any).score || '-';
        else if (colKey === 'passed') rawVal = (student as any).passed ? '통과' : '미통과';
        else rawVal = String((student as any)[colKey] ?? '-');

        if (!selectedValues.includes(rawVal)) {
          return false;
        }
      }
      return true;
    });
  }, [studentItemTableData, columnFilters, selectedPeriodEval, selectedItemInfo]);

  // 2단계: 다중 정렬 적용
  const sortedItemData = useMemo(() => {
      if (!itemSort.length) return filteredItemData;
      
      return [...filteredItemData].sort((a,b) => {
        for (const sort of itemSort) {
            const { column, direction } = sort;
            const isAsc = direction === 'ascending';

            let valA: any, valB: any;
            
            if(column === 'name') { valA = a.name; valB = b.name }
            else if(column === 'grade') { valA = a.grade; valB = b.grade }
            else if(column === 'classNum') { valA = a.classNum; valB = b.classNum }
            else if(column === 'studentNum') { valA = a.studentNum; valB = b.studentNum }
            else if(column === 'latestDate'){ valA = (a as any).latestDate; valB = (b as any).latestDate }
            else if(column === 'value'){ valA = (a as any).value || (a as any).score; valB = (b as any).value || (b as any).score }
            else if(column === 'recordGrade'){ valA = (a as any).recordGrade; valB = (b as any).recordGrade }
            else if(column === 'evalGrade'){ valA = (a as any).evalGrade; valB = (b as any).evalGrade }
            else if(column.startsWith('sub_')){ 
              const subName = column.replace('sub_', '');
              valA = (a as any).itemScores?.[subName]; 
              valB = (b as any).itemScores?.[subName]; 
            }
            else if(column === 'rank'){ valA = (a as any).rank; valB = (b as any).rank }
            else { valA = (a as any)[column]; valB = (b as any)[column]; }


            if (valA == null) return 1;
            if (valB == null) return -1;
            
            let comparison = 0;
            if (column === 'value' || column === 'recordGrade' || column === 'rank' || column === 'grade' || column === 'classNum' || column === 'studentNum' || column.startsWith('sub_')) {
                const itemInfo = allItems.find(i => i.name === selectedItem);
                
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);

                comparison = numA - numB;

                 if (itemInfo?.recordType === 'time') {
                    comparison = -comparison;
                }
            } else if (column === 'latestDate') {
                const dateA = new Date(valA).getTime();
                const dateB = new Date(valB).getTime();
                comparison = dateA - dateB;
            } else {
                comparison = String(valA).localeCompare(String(valB));
            }
            
            if (comparison !== 0) {
                return isAsc ? comparison : -comparison;
            }
        }
        return 0;
      });
  }, [studentItemTableData, itemSort, selectedItem, allItems]);


  const handleItemDownloadExcel = () => {
    if (sortedItemData.length === 0) {
      toast({
        variant: 'destructive',
        title: '다운로드 실패',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }

    if (selectedPeriodEval) {
      const targetItems = (selectedPeriodEval.criteria?.itemNames && selectedPeriodEval.criteria.itemNames.length > 0)
        ? selectedPeriodEval.criteria.itemNames
        : (selectedPeriodEval.itemNames && selectedPeriodEval.itemNames.length > 0
            ? selectedPeriodEval.itemNames
            : allItems.filter(i => i.isMeasurementWeek && !i.isArchived && !i.isDeactivated).map(i => i.name));

      const dataToExport = sortedItemData.map(s => {
        const row: Record<string, any> = {
          '학년': s.grade,
          '반': s.classNum,
          '번호': s.studentNum,
          '이름': s.name,
          '최근 측정일': s.latestDate || '-',
        };

        targetItems.forEach(itemName => {
          const score = (s as any).itemScores?.[itemName];
          row[itemName] = score !== null && score !== undefined ? `${score}개` : '-';
        });

        row['총점 (합산)'] = s.value !== null && s.value !== undefined ? `${s.value}점` : '-';
        row['평가 결과'] = (s as any).evalGrade || '-';
        row['순위'] = s.rank ? `${s.rank}등` : '-';
        return row;
      });

      const fileName = `${selectedPeriodEval.name}_종합평가_현황_${new Date().toISOString().split('T')[0]}.xlsx`;
      exportToExcel(fileName, dataToExport);
      toast({
        title: '다운로드 시작',
        description: `${selectedPeriodEval.name} 종합 평가 결과를 엑셀 파일로 다운로드합니다.`,
      });
      return;
    }

    if (selectedItem === 'theory-exam') {
      const dataToExport = sortedItemData.map(s => ({
        '학년': s.grade,
        '반': s.classNum,
        '번호': s.studentNum,
        '이름': s.name,
        '평가 제목': (s as any).quizTitle || '-',
        '점수': (s as any).score || '-',
        '통합 여부': (s as any).passed ? '통과' : '미통과',
        '응시일': (s as any).latestDate || '-',
      }));
      const fileName = `이론평가_현황_${new Date().toISOString().split('T')[0]}.xlsx`;
      exportToExcel(fileName, dataToExport);
      toast({ title: '다운로드 시작', description: '이론 평가 현황을 엑셀 파일로 다운로드합니다.' });
      return;
    }

    const itemInfo = allItems.find(i => i.name === selectedItem);
    const dataToExport = sortedItemData.map(s => {
      const row: any = {
        '학년': s.grade,
        '반': s.classNum,
        '번호': s.studentNum,
        '이름': s.name,
        '최근 측정일': (s as any).latestDate || '-',
      };

      if (itemInfo?.isCompound) {
        row['키(cm)'] = (s as any).height || '-';
        row['몸무게(kg)'] = (s as any).weight || '-';
      }

      const recordLabel = itemInfo?.name === '체질량지수(BMI)' ? 'BMI' : '기록';
      row[recordLabel] = (s as any).value !== undefined ? `${(s as any).value}${itemInfo?.unit || ''}` : '-';
      row['등급'] = (s as any).recordGrade ? `${(s as any).recordGrade}등급` : '-';
      row['순위'] = (s as any).rank ? `${(s as any).rank}등` : '-';
      
      return row;
    });
    const fileName = `${selectedItem}_기록 현황_${new Date().toISOString().split('T')[0]}.xlsx`;
    exportToExcel(fileName, dataToExport);
    toast({
      title: '다운로드 시작',
      description: `${selectedItem} 기록을 엑셀 파일로 다운로드합니다.`,
    });
  };


  useEffect(() => {
    setClassNumFilter('all');
  }, [gradeFilter]);
  
  useEffect(() => {
    setItemClassNumFilter('all');
  }, [itemGradeFilter]);
  
  // 컬럼별 고유 값 목록 추출 함수 (엑셀 필터 팝오버용)
  const getDistinctColumnValues = (colKey: string): string[] => {
    const set = new Set<string>();
    studentItemTableData.forEach(student => {
      let rawVal = '';
      if (colKey === 'name') rawVal = student.name;
      else if (colKey === 'grade') rawVal = `${student.grade}학년`;
      else if (colKey === 'classNum') rawVal = `${student.classNum}반`;
      else if (colKey === 'studentNum') rawVal = `${student.studentNum}번`;
      else if (colKey === 'latestDate') rawVal = (student as any).latestDate || '-';
      else if (colKey === 'value') {
        rawVal = (student as any).value !== null && (student as any).value !== undefined
          ? (selectedPeriodEval ? `${(student as any).value}점` : `${(student as any).value}${selectedItemInfo?.unit || ''}`)
          : '-';
      }
      else if (colKey === 'evalGrade') rawVal = (student as any).evalGrade || '-';
      else if (colKey === 'recordGrade') rawVal = (student as any).recordGrade ? `${(student as any).recordGrade}등급` : '-';
      else if (colKey.startsWith('sub_')) {
        const subName = colKey.replace('sub_', '');
        const score = (student as any).itemScores?.[subName];
        rawVal = score !== null && score !== undefined ? `${score}개` : '-';
      }
      else if (colKey === 'rank') {
        rawVal = (student as any).rank ? `${(student as any).rank}등` : '-';
      }
      else if (colKey === 'quizTitle') rawVal = (student as any).quizTitle || '-';
      else if (colKey === 'score') rawVal = (student as any).score || '-';
      else if (colKey === 'passed') rawVal = (student as any).passed ? '통과' : '미통과';
      else rawVal = String((student as any)[colKey] ?? '-');

      set.add(rawVal);
    });

    return Array.from(set).sort((a, b) => {
      // 숫자 포함 시 숫자 오름차순, 그 외 한글 가나다순
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  };

  const handleSetSort = (column: string, direction: 'ascending' | 'descending') => {
    setItemSort([{ column, direction }]);
  };

  const handleToggleColumnFilterValue = (colKey: string, val: string, allVals: string[]) => {
    const currentSelected = columnFilters[colKey] !== undefined 
      ? columnFilters[colKey] 
      : allVals; // 초기에는 전체 선택 상태

    const isChecked = currentSelected.includes(val);
    const nextSelected = isChecked
      ? currentSelected.filter(v => v !== val)
      : [...currentSelected, val];

    setColumnFilters(prev => ({
      ...prev,
      [colKey]: nextSelected
    }));
  };

  const handleSelectAllColumnFilter = (colKey: string, allVals: string[], selectAll: boolean) => {
    setColumnFilters(prev => ({
      ...prev,
      [colKey]: selectAll ? allVals : []
    }));
  };

  const clearColumnFilter = (colKey: string) => {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[colKey];
      return next;
    });
  };

  const createSortHandler = (column: string, sortState: SortDescriptor[], setSortState: (descriptor: SortDescriptor[]) => void) => () => {
    const existingSortIndex = sortState.findIndex(s => s.column === column);

    if (existingSortIndex > -1) {
        const newSortState = [...sortState];
        const currentSort = newSortState[existingSortIndex];
        if (currentSort.direction === 'ascending') {
            currentSort.direction = 'descending';
            setSortState(newSortState);
        } else {
            newSortState.splice(existingSortIndex, 1);
            setSortState(newSortState);
        }
    } else {
        const newSort = { column, direction: 'ascending' as const };
        setSortState([...sortState, newSort]);
    }
  };
  
  const getSortIndicator = (column: string, sortState: SortDescriptor[]) => {
    const sortIndex = sortState.findIndex(s => s.column === column);
    if (sortIndex === -1) return null;
    
    const sort = sortState[sortIndex];
    return (
        <span className="ml-1 text-xs font-normal">
            {sortState.length > 1 && <span className="text-muted-foreground mr-1">{sortIndex + 1}</span>}
            {sort.direction === 'ascending' ? '▲' : '▼'}
        </span>
    );
};


  return (
    <Card className="bg-transparent shadow-none border-none w-full max-w-full">
        <CardHeader className="px-0 sm:px-6 py-1 sm:py-3">
            <CardTitle className="text-base sm:text-xl font-bold truncate">기록 조회</CardTitle>
            <CardDescription className="text-[11px] sm:text-xs text-muted-foreground truncate">
                PAPS 종합 현황 또는 종목별 학생 기록을 조회하고 다운로드할 수 있습니다. 헤더 클릭 시 다중 정렬됩니다.
            </CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6 py-1 sm:py-3">
            <Tabs defaultValue="paps">
                <TabsList className="grid w-full grid-cols-2 h-7 sm:h-9 mb-1 sm:mb-3">
                    <TabsTrigger value="paps" className="text-xs sm:text-sm py-1">PAPS 종합</TabsTrigger>
                    <TabsTrigger value="item" className="text-xs sm:text-sm py-1">종목별 기록</TabsTrigger>
                </TabsList>
                <TabsContent value="paps" className="space-y-2 sm:space-y-4">
                     <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-2">
                        <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setGradeFilter('all'); setClassNumFilter('all'); } }}>
                          <SelectTrigger className="w-[95px] sm:w-[130px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold">
                            <SelectValue placeholder="클럽 필터" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 클럽</SelectItem>
                            {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select
                            value={gradeFilter}
                            onValueChange={(value) => {
                                setGradeFilter(value);
                                setClassNumFilter('all');
                                if(value !== 'all') setSelectedClubId('all');
                            }}
                        >
                            <SelectTrigger className="w-[68px] sm:w-[90px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 학년</SelectItem>
                            {grades.map((grade) => (
                                <SelectItem key={grade} value={grade}>
                                {grade}학년
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={classNumFilter}
                            onValueChange={setClassNumFilter}
                            disabled={gradeFilter === 'all'}
                        >
                            <SelectTrigger className="w-[58px] sm:w-[80px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="반" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 반</SelectItem>
                            {classNumsByGrade[gradeFilter]?.map((classNum) => (
                                <SelectItem key={classNum} value={classNum}>
                                {classNum}반
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("w-[100px] sm:w-[150px] h-7 sm:h-8 px-2 text-[11px] sm:text-xs justify-start text-left font-normal", !dateFilter && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{dateFilter === 'latest' ? '최근' : dateFilter ? format(dateFilter, "MM/dd") : '날짜'}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
                                <Select onValueChange={(value) => value === 'latest' ? setDateFilter('latest') : setDateFilter(new Date(value))}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="측정일 선택" />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        <SelectItem value="latest">최근 측정일 기준</SelectItem>
                                        {availableDates.map(date => (
                                            <SelectItem key={date} value={date}>{date}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="rounded-md border">
                                    <Calendar mode="single" selected={dateFilter === 'latest' ? undefined : dateFilter} onSelect={(d) => setDateFilter(d)} />
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Select value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
                            <SelectTrigger className="w-[75px] sm:w-[110px] h-7 sm:h-8 text-[11px] sm:text-xs">
                                <SelectValue placeholder="형식" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grade">등급</SelectItem>
                                <SelectItem value="score">점수</SelectItem>
                                <SelectItem value="record">실제 기록</SelectItem>
                            </SelectContent>
                        </Select>
                        
                        <Button onClick={handlePapsDownloadExcel} variant="outline" size="sm" className="ml-auto h-7 sm:h-8 px-2 text-xs" title="엑셀 다운로드">
                            <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">엑셀 다운로드</span>
                        </Button>
                    </div>
                     <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow className="h-8">
                                {finalFactorOrder.map(key => {
                                    const columnKey = key.replace(/점수|등급/g, '');
                                    const isNarrow = ['학년', '반', '번호', '성별'].includes(columnKey);
                                    return (
                                        <TableHead 
                                            key={key} 
                                            onClick={createSortHandler(columnKey, papsSort, setPapsSort)} 
                                            className={cn(
                                                "cursor-pointer hover:bg-muted whitespace-nowrap p-1 text-[11px] sm:text-xs font-bold",
                                                isNarrow ? "w-8 sm:w-10 text-center" : columnKey === '이름' ? "min-w-[50px] text-left" : "text-center min-w-[55px] sm:min-w-[70px]"
                                            )}
                                        >
                                            {key}
                                            {getSortIndicator(columnKey, papsSort)}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {sortedPapsData.length > 0 ? (
                                sortedPapsData.map((row, index) => (
                                <TableRow key={index} className="h-9 sm:h-10">
                                    {finalFactorOrder.map((key, cellIndex) => {
                                    const displayKey = key.replace(/점수|등급/g, '');
                                    const isNarrow = ['학년', '반', '번호', '성별'].includes(displayKey);
                                    const isName = displayKey === '이름';
                                    return (
                                        <TableCell 
                                            key={cellIndex} 
                                            className={cn(
                                                "whitespace-nowrap p-1 text-[11px] sm:text-xs",
                                                isNarrow ? "text-center" : isName ? "font-bold text-left" : "text-center font-medium"
                                            )}
                                        >
                                            {row[displayKey]}
                                        </TableCell>
                                    )
                                    })}
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                <TableCell colSpan={finalFactorOrder.length} className="h-20 text-center text-xs text-muted-foreground">
                                    선택된 조건에 해당하는 기록이 없습니다.
                                </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
                <TabsContent value="item" className="space-y-2 sm:space-y-4">
                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-2">
                       <Select value={selectedItem} onValueChange={setSelectedItem}>
                          <SelectTrigger className="w-[140px] sm:w-[180px] h-7 sm:h-8 text-[11px] sm:text-xs font-semibold">
                            <SelectValue placeholder="종목 선택" />
                          </SelectTrigger>
                          <SelectContent className="max-h-96 min-w-[220px]">
                            {/* 1. 상위 종합 평가 주간 항목 */}
                            {measurementPeriods.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="text-[10px] sm:text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-sm mt-1 mb-0.5 flex items-center justify-between">
                                  <span>🏆 기간 종합 평가 ({measurementPeriods.length})</span>
                                </SelectLabel>
                                {measurementPeriods.map((period) => (
                                  <SelectItem 
                                    key={period.id} 
                                    value={`period-eval:${period.id}`}
                                    className="text-xs font-bold text-primary"
                                  >
                                    🏅 {period.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}

                            <SelectSeparator className="my-1" />

                            <SelectItem value="theory-exam" className="font-bold text-primary flex items-center">
                                <BookOpen className="h-3.5 w-3.5 mr-1.5" /> 이론 평가
                            </SelectItem>

                            {groupedItemsWithRecords.paps.length > 0 && (
                              <SelectGroup>
                                <SelectLabel className="text-[10px] sm:text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-sm mt-1 mb-0.5">
                                  PAPS 정규 종목 ({groupedItemsWithRecords.paps.length})
                                </SelectLabel>
                                {groupedItemsWithRecords.paps.map((item) => (
                                  <SelectItem key={item.id} value={item.name} className="text-xs">
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            )}

                            {groupedItemsWithRecords.sports.map((group) => (
                              <SelectGroup key={group.category}>
                                <SelectSeparator className="my-1" />
                                <SelectLabel className="text-[10px] sm:text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-sm mb-0.5">
                                  {group.category} ({group.items.length})
                                </SelectLabel>
                                {group.items.map((item) => (
                                  <SelectItem key={item.id} value={item.name} className="text-xs font-medium">
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                       </Select>
                        <Select value={selectedClubId} onValueChange={(v) => { setSelectedClubId(v); if(v !== 'all') { setItemGradeFilter('all'); setItemClassNumFilter('all'); } }}>
                          <SelectTrigger className="w-[95px] sm:w-[130px] h-7 sm:h-8 text-[11px] sm:text-xs font-bold">
                            <SelectValue placeholder="클럽 필터" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체 클럽</SelectItem>
                            {sportsClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={itemGradeFilter} onValueChange={(value) => {setItemGradeFilter(value); setItemClassNumFilter('all'); if(value !== 'all') setSelectedClubId('all');}}>
                            <SelectTrigger className="w-[68px] sm:w-[90px] h-7 sm:h-8 text-[11px] sm:text-xs">
                                <SelectValue placeholder="학년" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 학년</SelectItem>
                                {grades.map((grade) => (
                                <SelectItem key={grade} value={grade}>{grade}학년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={itemClassNumFilter}
                            onValueChange={setItemClassNumFilter}
                            disabled={itemGradeFilter === 'all'}
                        >
                            <SelectTrigger className="w-[58px] sm:w-[80px] h-7 sm:h-8 text-[11px] sm:text-xs">
                            <SelectValue placeholder="반" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">전체 반</SelectItem>
                            {classNumsByGrade[itemGradeFilter]?.map((classNum) => (
                                <SelectItem key={classNum} value={classNum}>
                                {classNum}반
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        {isAnyFilterActive && (
                          <Button 
                            onClick={clearAllFilters} 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 sm:h-8 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold flex items-center gap-1 border border-amber-500/30 ml-auto"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>필터 초기화</span>
                          </Button>
                        )}
                        <Button onClick={handleItemDownloadExcel} variant="outline" size="sm" className={cn("h-7 sm:h-8 px-2 text-xs", !isAnyFilterActive && "ml-auto")} disabled={!selectedItem} title="엑셀 다운로드">
                            <FileDown className="h-3.5 w-3.5 sm:mr-1.5" />
                            <span className="hidden sm:inline">엑셀 다운로드</span>
                        </Button>
                    </div>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="h-8">
                                    {[
                                      { key: 'grade', label: '학년', isNarrow: true },
                                      { key: 'classNum', label: '반', isNarrow: true },
                                      { key: 'studentNum', label: '번호', isNarrow: true },
                                      { key: 'name', label: '이름', isName: true },
                                      ...(selectedPeriodEval ? [
                                        { key: 'latestDate', label: '최근 측정일' },
                                        ...(((selectedPeriodEval.criteria?.itemNames && selectedPeriodEval.criteria.itemNames.length > 0)
                                          ? selectedPeriodEval.criteria.itemNames
                                          : (selectedPeriodEval.itemNames || [])).map(itemName => ({
                                            key: `sub_${itemName}`,
                                            label: itemName
                                          }))),
                                        { key: 'value', label: '총점(합산)' },
                                        { key: 'evalGrade', label: '평가 결과' },
                                        { key: 'rank', label: '순위' },
                                      ] : selectedItem === 'theory-exam' ? [
                                        { key: 'quizTitle', label: '평가 제목' },
                                        { key: 'score', label: '점수' },
                                        { key: 'latestDate', label: '응시일' },
                                        { key: 'passed', label: '통과' }
                                      ] : [
                                        { key: 'latestDate', label: '측정일' },
                                        ...(selectedItemInfo?.isCompound ? [
                                          { key: 'height', label: '키' },
                                          { key: 'weight', label: '몸무게' }
                                        ] : []),
                                        { key: 'value', label: '기록' },
                                        { key: 'recordGrade', label: '등급' },
                                        { key: 'rank', label: '순위' },
                                      ])
                                    ].map((header) => {
                                      const distinctVals = getDistinctColumnValues(header.key);
                                      const activeFilteredVals = columnFilters[header.key];
                                      const isColumnFiltered = activeFilteredVals !== undefined && activeFilteredVals.length < distinctVals.length;
                                      const currentSearch = (columnSearchTerm[header.key] || '').toLowerCase();
                                      const filteredDistinctVals = distinctVals.filter(v => v.toLowerCase().includes(currentSearch));
                                      const isAllChecked = !activeFilteredVals || activeFilteredVals.length === distinctVals.length;

                                      return (
                                       <TableHead 
                                          key={header.key} 
                                          className={cn(
                                              "whitespace-nowrap p-1 text-[11px] sm:text-xs font-bold select-none group",
                                              header.isNarrow ? "w-8 sm:w-10 text-center" : header.isName ? "min-w-[50px] text-left" : "text-center min-w-[50px] sm:min-w-[70px]",
                                              isColumnFiltered && "bg-primary/10 text-primary"
                                          )}
                                       >
                                          <div className={cn("inline-flex items-center gap-1", header.isNarrow ? "justify-center" : header.isName ? "justify-start" : "justify-center")}>
                                            <span 
                                              onClick={createSortHandler(header.key, itemSort, setItemSort)} 
                                              className="cursor-pointer hover:underline flex items-center"
                                              title="클릭 시 다중 정렬"
                                            >
                                              {header.label}
                                              {getSortIndicator(header.key, itemSort)}
                                            </span>

                                            {/* 엑셀 스타일 드롭다운 필터/정렬 트리거 */}
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className={cn(
                                                    "h-5 w-5 p-0 rounded hover:bg-muted/80 transition-colors",
                                                    isColumnFiltered ? "text-primary font-bold bg-primary/20" : "text-muted-foreground/60 hover:text-foreground"
                                                  )}
                                                  title="${header.label} 정렬 및 필터"
                                                >
                                                  <Filter className={cn("h-3 w-3", isColumnFiltered && "fill-primary")} />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent align="start" className="w-56 p-2 space-y-2 shadow-lg border text-xs">
                                                {/* 상단: 정렬 옵션 */}
                                                <div className="space-y-1 pb-1.5 border-b border-border/60">
                                                  <button
                                                    onClick={() => handleSetSort(header.key, 'ascending')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-left font-medium"
                                                  >
                                                    <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                                                    <span>오름차순 정렬</span>
                                                  </button>
                                                  <button
                                                    onClick={() => handleSetSort(header.key, 'descending')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-left font-medium"
                                                  >
                                                    <ArrowDown className="h-3.5 w-3.5 text-red-600" />
                                                    <span>내림차순 정렬</span>
                                                  </button>
                                                </div>

                                                {/* 중단: 필터 검색 입력창 */}
                                                <div className="relative">
                                                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                                                  <Input 
                                                    placeholder="값 검색..."
                                                    value={columnSearchTerm[header.key] || ''}
                                                    onChange={e => setColumnSearchTerm(prev => ({ ...prev, [header.key]: e.target.value }))}
                                                    className="h-7 pl-7 text-[11px]"
                                                  />
                                                </div>

                                                {/* (전체 선택) 체크박스 */}
                                                <div className="flex items-center justify-between px-1 pt-1 border-b pb-1 text-[11px]">
                                                  <div className="flex items-center gap-2">
                                                    <Checkbox 
                                                      id={`filter-all-${header.key}`}
                                                      checked={isAllChecked}
                                                      onCheckedChange={(checked) => handleSelectAllColumnFilter(header.key, distinctVals, !!checked)}
                                                    />
                                                    <label htmlFor={`filter-all-${header.key}`} className="cursor-pointer font-semibold">
                                                      (모두 선택)
                                                    </label>
                                                  </div>
                                                  {isColumnFiltered && (
                                                    <button 
                                                      onClick={() => clearColumnFilter(header.key)}
                                                      className="text-[10px] text-primary hover:underline font-medium"
                                                    >
                                                      필터 해제
                                                    </button>
                                                  )}
                                                </div>

                                                {/* 하단: 고유 값 체크박스 목록 (스크롤) */}
                                                <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                                                  {filteredDistinctVals.length > 0 ? (
                                                    filteredDistinctVals.map((val) => {
                                                      const currentSelected = activeFilteredVals !== undefined ? activeFilteredVals : distinctVals;
                                                      const isChecked = currentSelected.includes(val);
                                                      return (
                                                        <div 
                                                          key={val} 
                                                          onClick={() => handleToggleColumnFilterValue(header.key, val, distinctVals)}
                                                          className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/60 cursor-pointer text-[11px]"
                                                        >
                                                          <Checkbox 
                                                            id={`filter-${header.key}-${val}`}
                                                            checked={isChecked}
                                                            onCheckedChange={() => {}}
                                                          />
                                                          <span className="truncate flex-1 font-medium">{val}</span>
                                                        </div>
                                                      );
                                                    })
                                                  ) : (
                                                    <div className="text-center py-2 text-[10px] text-muted-foreground">
                                                      일치하는 항목 없음
                                                    </div>
                                                  )}
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                       </TableHead>
                                      );
                                    })}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedItemData.length > 0 ? (
                                    sortedItemData.map((s, idx) => (
                                        <TableRow key={`${s.id}-${idx}`} className="h-9 sm:h-10">
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.grade}</TableCell>
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.classNum}</TableCell>
                                            <TableCell className="p-1 text-center text-[11px] sm:text-xs">{s.studentNum}</TableCell>
                                            <TableCell className="p-1 text-left font-bold whitespace-nowrap text-[11px] sm:text-xs">{s.name}</TableCell>
                                            {selectedPeriodEval ? (
                                                <>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).latestDate || '-'}</TableCell>
                                                    {(((selectedPeriodEval.criteria?.itemNames && selectedPeriodEval.criteria.itemNames.length > 0)
                                                      ? selectedPeriodEval.criteria.itemNames
                                                      : (selectedPeriodEval.itemNames || [])).map(itemName => {
                                                        const score = (s as any).itemScores?.[itemName];
                                                        return (
                                                          <TableCell key={itemName} className="p-1 text-center text-[11px] sm:text-xs">
                                                            {score !== null && score !== undefined ? `${score}개` : <span className="text-muted-foreground/50">-</span>}
                                                          </TableCell>
                                                        );
                                                    }))}
                                                    <TableCell className="p-1 text-center font-bold text-primary whitespace-nowrap text-[11px] sm:text-xs">
                                                        {(s as any).value !== null && (s as any).value !== undefined ? `${(s as any).value}점` : '-'}
                                                    </TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">
                                                        {(s as any).evalGrade === '잘함' ? (
                                                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 font-bold">잘함</Badge>
                                                        ) : (s as any).evalGrade === '보통' ? (
                                                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0 font-bold">보통</Badge>
                                                        ) : (s as any).evalGrade === '노력요함' ? (
                                                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] px-1.5 py-0 font-bold">노력요함</Badge>
                                                        ) : (
                                                          <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).rank ? `${(s as any).rank}/${(s as any).totalRanked}` : '-'}</TableCell>
                                                </>
                                            ) : selectedItem === 'theory-exam' ? (
                                                <>
                                                    <TableCell className="p-1 max-w-[150px] truncate text-[11px] sm:text-xs">{(s as any).quizTitle}</TableCell>
                                                    <TableCell className="p-1 text-center font-semibold text-[11px] sm:text-xs">{(s as any).score}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).latestDate || '-'}</TableCell>
                                                    <TableCell className="p-1 text-center">
                                                        {(s as any).passed !== undefined ? (
                                                            (s as any).passed ? 
                                                                <Badge className="bg-green-100 text-green-700 text-[10px] px-1 py-0">통과</Badge> : 
                                                                <Badge variant="destructive" className="text-[10px] px-1 py-0">미통과</Badge>
                                                        ) : '-'}
                                                    </TableCell>
                                                </>
                                            ) : (
                                                <>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).latestDate || '-'}</TableCell>
                                                    {allItems.find(i => i.name === selectedItem)?.isCompound && (
                                                      <>
                                                        <TableCell className="p-1 text-center text-[11px] sm:text-xs">{(s as any).height || '-'}</TableCell>
                                                        <TableCell className="p-1 text-center text-[11px] sm:text-xs">{(s as any).weight || '-'}</TableCell>
                                                      </>
                                                    )}
                                                    <TableCell className="p-1 text-center font-bold whitespace-nowrap text-[11px] sm:text-xs">{(s as any).value !== undefined && (s as any).value !== null ? `${(s as any).value}${allItems.find(i => i.name === selectedItem)?.unit || ''}`: '-'}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).recordGrade ? `${(s as any).recordGrade}등급` : '-'}</TableCell>
                                                    <TableCell className="p-1 text-center whitespace-nowrap text-[11px] sm:text-xs">{(s as any).rank ? `${(s as any).rank}/${(s as any).totalRanked}` : '-'}</TableCell>
                                                </>
                                            )}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-20 text-center text-xs text-muted-foreground">
                                            조회할 종목을 선택해주세요.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}
