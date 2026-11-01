import { useQuery } from '@tanstack/react-query';
import type { ComponentRef } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { componentsQuery } from '../../lib/tracking';
import { CheckRow, Popover } from '../../ui/Popover';

interface ComponentsFieldProps {
  projectKey: string;
  value: ComponentRef[];
  disabled: boolean;
  onChange: (componentIds: string[]) => void;
}

/** Component chips with a checkbox popover; each toggle saves right away. */
export function ComponentsField({ projectKey, value, disabled, onChange }: ComponentsFieldProps) {
  const { t } = useTranslation();
  const components = useQuery({ ...componentsQuery(projectKey), enabled: !disabled });
  const selected = new Set(value.map((component) => component.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <Popover
      label={t('issues.components')}
      triggerLabel={t('issues.components')}
      disabled={disabled}
      triggerClassName="flex min-h-[var(--control-sm)] w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-transparent px-1.5 py-0.5 text-left hover:border-[var(--border-strong)] disabled:hover:border-transparent"
      trigger={
        value.length === 0 ? (
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
        )
      }
    >
      <div className="flex flex-col gap-0.5 overflow-y-auto p-1">
        {components.data?.length === 0 && (
          <p className="m-0 px-2 py-1.5 text-[var(--ink-muted)]">{t('issues.noComponents')}</p>
        )}
        {components.data?.map((component) => (
          <CheckRow
            key={component.id}
            checked={selected.has(component.id)}
            onChange={() => toggle(component.id)}
          >
            {component.name}
          </CheckRow>
        ))}
      </div>
    </Popover>
  );
}
