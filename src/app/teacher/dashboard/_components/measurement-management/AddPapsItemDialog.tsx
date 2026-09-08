'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
import { papsStandards } from '@/lib/paps';
import { addItem, deactivateItem } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { MeasurementItem } from '@/lib/types';

export function AddPapsItemDialog({ onAdd, currentItems, school }: { onAdd: () => Promise<void>, currentItems: MeasurementItem[], school: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // PAPS 전체 종목 목록 - 현재 활성화 여부와 상관없이 모두 포함
  const allPapsNames = Object.keys(papsStandards);

  // 활성화된 PAPS 종목 이름 목록
  const activeNames = new Set(
    currentItems.filter(i => i.isPaps && !i.isDeactivated && !i.isArchived).map(i => i.name)
  );

  // 비활성화된 PAPS 종목 맵 (이름 -> item)
  const deactivatedMap = new Map(
    currentItems.filter(i => i.isPaps && (i.isDeactivated || i.isArchived)).map(i => [i.name, i])
  );

  // 로컬 체크 상태: 활성화된 종목은 true 고정, 비활성화된 종목은 초기 false
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    allPapsNames.forEach(name => {
      initial[name] = activeNames.has(name);
    });
    return initial;
  });

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      // 다이얼로그 열릴 때 최신 상태로 초기화
      const initial: Record<string, boolean> = {};
      allPapsNames.forEach(name => {
        initial[name] = activeNames.has(name);
      });
      setChecked(initial);
    }
    setOpen(isOpen);
  };

  const handleToggle = (name: string, isChecked: boolean) => {
    // 이미 활성화된 종목은 비활성화 토글 불가 (별도 편집/비활성화 메뉴로 처리)
    if (activeNames.has(name)) return;
    setChecked(prev => ({ ...prev, [name]: isChecked }));
  };

  const handleSubmit = async () => {
    if (!school) return;
    setIsSubmitting(true);
    try {
      const tasks: Promise<void>[] = [];

      for (const name of allPapsNames) {
        const wasActive = activeNames.has(name);
        const isNowChecked = checked[name];

        if (!wasActive && isNowChecked) {
          // 비활성화 -> 활성화
          const existingItem = deactivatedMap.get(name);
          if (existingItem) {
            // 이미 존재하는 종목: deactivateItem으로 isDeactivated=false 처리
            tasks.push(deactivateItem(school, existingItem.id, false));
          } else {
            // DB에 아예 없는 종목: 신규 추가
            const standard = papsStandards[name as keyof typeof papsStandards];
            tasks.push(addItem(school, {
              name,
              unit: standard.unit,
              recordType: standard.type,
              isPaps: true,
              isCompound: standard.type === 'compound',
              category: 'PAPS',
            }).then(() => {}));
          }
        }
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
        await onAdd();
        toast({ title: 'PAPS 종목 활성화 완료' });
      }
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" /> PAPS
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>PAPS 종목 추가/활성화</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            체크된 종목은 활성 목록에 포함됩니다. 비활성화된 종목을 체크하면 다시 활성화됩니다.
          </p>
        </DialogHeader>
        <div className="py-3 space-y-2 max-h-72 overflow-y-auto pr-1">
          {allPapsNames.map(name => {
            const isActive = activeNames.has(name);
            const isCheckedNow = checked[name];
            return (
              <div key={name} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-primary/10 border-primary/30 opacity-60'
                  : isCheckedNow
                  ? 'bg-muted border-primary/50'
                  : 'bg-background border-border'
              }`}>
                <Checkbox
                  id={`paps-${name}`}
                  checked={isCheckedNow}
                  onCheckedChange={(c) => handleToggle(name, !!c)}
                  disabled={isActive}
                />
                <Label
                  htmlFor={`paps-${name}`}
                  className={`flex-1 text-sm font-medium cursor-pointer ${
                    isActive ? 'text-muted-foreground' : ''
                  }`}
                >
                  {name}
                </Label>
                {isActive && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    활성
                  </span>
                )}
                {!isActive && deactivatedMap.has(name) && (
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    비활성
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">취소</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !Object.entries(checked).some(
              ([name, val]) => val && !activeNames.has(name)
            )}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            활성화 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
