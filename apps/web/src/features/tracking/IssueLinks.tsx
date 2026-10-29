import { LinkSimple, X } from '@phosphor-icons/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { Issue, IssueLink, IssueLinkTypeInfo } from '@tasklore/shared';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { valueSuggestionsQuery } from '../../lib/search';
import { trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { IssueTypeIcon, StatusLozenge } from './icons';

/** Built-in link phrases are translated by key; custom types keep their stored phrase. */
function useLinkPhrase() {
  const { t, i18n } = useTranslation();
  return (type: IssueLinkTypeInfo, direction: IssueLink['direction']) => {
    const key = `meta.linkType.${type.key}.${direction}`;
    return i18n.exists(key) ? t(key as never) : type[direction];
  };
}

interface IssueLinksProps {
  issue: Issue;
  canEdit: boolean;
  onChanged: (issue?: Issue) => void;
}

/** Linked issues grouped by relation, e.g. "blocks" and "is blocked by" (T-ISS-04). */
export function IssueLinks({ issue, canEdit, onChanged }: IssueLinksProps) {
  const { t } = useTranslation();
  const phrase = useLinkPhrase();
  const meta = useQuery(trackingMetaQuery);
  const keyListId = useId();
  const [adding, setAdding] = useState(false);
  const [relation, setRelation] = useState('blocks:outward');
  const [target, setTarget] = useState('');
  const targetInput = useRef<HTMLInputElement>(null);
  // Opening the form moves the focus to the issue key, where typing continues.
  useEffect(() => {
    if (adding) targetInput.current?.focus();
  }, [adding]);
  const suggestions = useQuery({
    ...valueSuggestionsQuery('key', target.trim()),
    enabled: adding,
  });

  const add = useMutation({
    mutationFn: () => {
      const [type = '', direction] = relation.split(':');
      return unwrap(
        client.POST('/api/v1/issues/{key}/links', {
          params: { path: { key: issue.key } },
          body: {
            type,
            direction: direction === 'inward' ? 'inward' : 'outward',
            issueKey: target.trim(),
          },
        }),
      );
    },
    onSuccess: (updated) => {
      setTarget('');
      setAdding(false);
      onChanged(updated);
    },
  });
  const remove = useMutation({
    mutationFn: (linkId: string) =>
      unwrap(
        client.DELETE('/api/v1/issues/{key}/links/{linkId}', {
          params: { path: { key: issue.key, linkId } },
        }),
      ),
    onSuccess: () => onChanged(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (target.trim()) add.mutate();
  }

  // One option per direction; symmetric types ("relates to") need only one.
  const relations = (meta.data?.linkTypes ?? []).flatMap((type) =>
    type.outward === type.inward
      ? [{ value: `${type.key}:outward`, label: phrase(type, 'outward') }]
      : [
          { value: `${type.key}:outward`, label: phrase(type, 'outward') },
          { value: `${type.key}:inward`, label: phrase(type, 'inward') },
        ],
  );
  const groups = new Map<string, IssueLink[]>();
  for (const link of issue.links) {
    const label = phrase(link.type, link.direction);
    groups.set(label, [...(groups.get(label) ?? []), link]);
  }

  if (issue.links.length === 0 && !canEdit) return null;

  return (
    <section aria-label={t('issues.links')} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="tl-heading-md">{t('issues.links')}</h2>
        {canEdit && !adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <LinkSimple size={16} aria-hidden />
            {t('issues.addLink')}
          </Button>
        )}
      </div>
      {remove.error && <FormError message={remove.error.message} />}
      {adding && (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="tl-label uppercase text-[var(--ink-muted)]">
              {t('issues.linkRelation')}
            </span>
            <select
              value={relation}
              onChange={(event) => setRelation(event.target.value)}
              className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            >
              {relations.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="tl-label uppercase text-[var(--ink-muted)]">
              {t('issues.linkTarget')}
            </span>
            <input
              value={target}
              ref={targetInput}
              list={keyListId}
              required
              placeholder={t('issues.parentPlaceholder')}
              onChange={(event) => setTarget(event.target.value)}
              className="tl-key h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
            />
            <datalist id={keyListId}>
              {suggestions.data
                ?.filter((entry) => entry.value !== issue.key)
                .map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
            </datalist>
          </label>
          <Button type="submit" variant="primary" disabled={add.isPending || !target.trim()}>
            {t('issues.link')}
          </Button>
          <Button variant="ghost" onClick={() => setAdding(false)}>
            {t('common.cancel')}
          </Button>
          {add.error && (
            <div className="basis-full">
              <FormError message={add.error.message} />
            </div>
          )}
        </form>
      )}
      {[...groups.entries()].map(([label, links]) => (
        <div key={label} className="flex flex-col gap-1">
          <h3 className="tl-label uppercase text-[var(--ink-muted)]">{label}</h3>
          <ul className="m-0 list-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-0">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex h-[var(--row-comfortable)] items-center gap-2 border-b border-[var(--border)] px-3 last:border-b-0"
              >
                <IssueTypeIcon type={link.issue.issueType} />
                <Link
                  to="/issues/$key"
                  params={{ key: link.issue.key }}
                  className="tl-key no-underline hover:underline"
                >
                  {link.issue.key}
                </Link>
                <span className="min-w-0 flex-1 truncate">{link.issue.summary}</span>
                <StatusLozenge status={link.issue.status} />
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t('issues.removeLink', { key: link.issue.key })}
                    title={t('issues.removeLink', { key: link.issue.key })}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(link.id)}
                    className="grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <X size={14} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
