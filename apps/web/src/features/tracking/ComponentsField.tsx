import { useQuery } from '@tanstack/react-query';
import type { ComponentRef } from '@tasklore/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { componentsQuery } from '../../lib/tracking';

interface ComponentsFieldProps {
  projectKey: string;
  value: ComponentRef[];
  disabled: boolean;
  onChange: (componentIds: string[]) => void;
}

/** Component chips with a checkbox popover; each toggle saves right away. */
export function ComponentsField({ projectKey, value, disabled, onChange }: ComponentsFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const components = useQuery({ ...componentsQuery(projectKey), enabled: open });
  const selected = new Set(value.map((component) => component.id));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !container.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={t('issues.components')}
        onClick={() => setOpen(!open)}
        className="flex min-h-[var(--control-sm)] w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-transparent px-1.5 py-0.5 text-left hover:border-[var(--border-strong)] disabled:hover:border-transparent"
      >
        {value.length === 0 ? (
          <span className="text-[var(--ink-muted)]">{t('issues.none')}</span>
        ) : (
          value.map((component) => (
            <span
              key={component.id}
              className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold"
            >
              {component.name}
            </span>
          ))
        )}
      </button>
      {open && (
        <fieldset
          id={popoverId}
          className="absolute top-full left-0 z-10 m-0 mt-1 flex max-h-64 min-w-48 flex-col gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 shadow-[var(--shadow-float)]"
        >
          <legend className="sr-only">{t('issues.components')}</legend>
          {components.data?.length === 0 && (
            <p className="px-2 py-1.5 text-[var(--ink-muted)]">{t('issues.noComponents')}</p>
          )}
          {components.data?.map((component) => (
            <label
              key={component.id}
              className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 hover:bg-[var(--surface-2)]"
            >
              <input
                type="checkbox"
                checked={selected.has(component.id)}
                onChange={() => toggle(component.id)}
              />
              <span className="truncate">{component.name}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
