import { Columns } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_ISSUE_COLUMNS, type ListColumn } from '@toolvibes/shared';
import { useTranslation } from 'react-i18next';
import { useColumnCatalogue, useSetIssueColumns } from '../../lib/personal';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { CheckRow, Popover } from '../../ui/Popover';

/** Chooses the further columns of result lists; saved per person (T-QRY-08, E-48). */
export function ColumnPicker({ columns }: { columns: ListColumn[] }) {
  const { t } = useTranslation();
  const save = useSetIssueColumns();
  const catalogue = useColumnCatalogue();
  const fields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  const chosen = new Set(columns);
  const label = (column: ListColumn) =>
    column.startsWith('cf[')
      ? (fields.find((field) => `cf[${field.number}]` === column)?.name ?? column)
      : t(`issues.columns.${column as Exclude<ListColumn, `cf[${number}]`>}`);

  // Columns keep the catalogue's order, so the table looks the same however they were picked.
  function toggle(column: ListColumn) {
    const next = new Set(chosen);
    if (next.has(column)) next.delete(column);
    else next.add(column);
    save.mutate(catalogue.filter((option) => next.has(option)));
  }

  return (
    <Popover
      label={t('search.columns.title')}
      align="end"
      trigger={
        <>
          <Columns size={16} aria-hidden />
          {t('search.columns.button')}
        </>
      }
    >
      <p className="m-0 border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--ink-muted)]">
        {t('search.columns.hint')}
      </p>
      <div className="flex flex-col gap-0.5 overflow-y-auto p-1">
        {catalogue.map((column) => (
          <CheckRow
            key={column}
            checked={chosen.has(column)}
            onChange={() => toggle(column)}
            detail={column.startsWith('cf[') ? column : undefined}
          >
            {label(column)}
          </CheckRow>
        ))}
      </div>
      <div className="border-t border-[var(--border)] p-1">
        <Button size="sm" variant="ghost" onClick={() => save.mutate(DEFAULT_ISSUE_COLUMNS)}>
          {t('search.columns.reset')}
        </Button>
      </div>
    </Popover>
  );
}
