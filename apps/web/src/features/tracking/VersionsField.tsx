import { useQuery } from '@tanstack/react-query';
import type { VersionRef } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { versionsQuery } from '../../lib/tracking';
import { CheckRow, Popover } from '../../ui/Popover';

/** Fix or affects versions as chips with a checkbox popover (E-57); each toggle saves. */
export function VersionsField({
  projectKey,
  label,
  value,
  disabled,
  onChange,
}: {
  projectKey: string;
  label: string;
  value: VersionRef[];
  disabled: boolean;
  onChange: (versionIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const versions = useQuery({ ...versionsQuery(projectKey), enabled: !disabled });
  const selected = new Set(value.map((version) => version.id));
  // Archived versions stay listed while set, so they can be removed.
  const listed = (versions.data ?? []).filter(
    (version) => !version.archived || selected.has(version.id),
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <Popover
      label={label}
      triggerLabel={label}
      disabled={disabled}
      triggerClassName="flex min-h-[var(--control-sm)] w-full flex-wrap items-center gap-1 rounded-[var(--radius-md)] border border-transparent px-1.5 py-0.5 text-left hover:border-[var(--border-strong)] disabled:hover:border-transparent"
      trigger={
        value.length === 0 ? (
          <span className="text-[var(--ink-muted)]">{t('issues.none')}</span>
        ) : (
          value.map((version) => (
            <span
              key={version.id}
              className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-1.5 text-xs font-semibold"
            >
              {version.name}
              {version.released && ' ✓'}
            </span>
          ))
        )
      }
    >
      <div className="flex flex-col gap-0.5 overflow-y-auto p-1">
        {listed.length === 0 && (
          <p className="m-0 px-2 py-1.5 text-[var(--ink-muted)]">{t('versions.none')}</p>
        )}
        {listed.map((version) => (
          <CheckRow
            key={version.id}
            checked={selected.has(version.id)}
            onChange={() => toggle(version.id)}
            detail={version.released ? t('versions.released') : undefined}
          >
            {version.name}
          </CheckRow>
        ))}
      </div>
    </Popover>
  );
}
