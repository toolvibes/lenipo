import type { Me } from '@toolvibes/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { IssuePage } from './IssuePage';

const WIDE = '(min-width: 1024px)';

/** Whether a list has room for the detail beside it; narrower screens open the full page. */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const change = () => setWide(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return wide;
}

/** A list with the selected issue beside it (T-ISS-15, E-49); the selection lives in the URL. */
export function IssueSplit({
  me,
  selected,
  onClose,
  children,
}: {
  me: Me;
  selected: string | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  const wide = useWideScreen();
  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
      {wide && selected && (
        <div className="sticky top-0 max-h-screen w-[min(600px,50%)] shrink-0 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)]">
          <IssuePage key={selected} me={me} issueKey={selected} variant="panel" onClose={onClose} />
        </div>
      )}
    </div>
  );
}
