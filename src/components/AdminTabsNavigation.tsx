import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminTabsNavigationProps {
  activeTab: string;
  children: ReactNode;
}

export default function AdminTabsNavigation({ activeTab, children }: AdminTabsNavigationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 1);
    setCanScrollRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(updateScroll);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    updateScroll();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    const active = element?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!element || !active) return;
    const viewport = element.getBoundingClientRect();
    const tab = active.getBoundingClientRect();
    if (tab.left < viewport.left) {
      element.scrollBy({ left: tab.left - viewport.left, behavior: 'smooth' });
    } else if (tab.right > viewport.right) {
      element.scrollBy({ left: tab.right - viewport.right, behavior: 'smooth' });
    }
    updateScroll();
  }, [activeTab]);

  const scroll = (direction: number) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-3 py-4">
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="Ver abas anteriores" disabled={!canScrollLeft} onClick={() => scroll(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div ref={scrollRef} onScroll={updateScroll} className="min-w-0 flex-1 overflow-x-auto scrollbar-hide">
        {children}
      </div>
      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" aria-label="Ver próximas abas" disabled={!canScrollRight} onClick={() => scroll(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
