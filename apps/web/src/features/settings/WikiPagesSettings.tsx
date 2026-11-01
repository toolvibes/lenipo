import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectWikiPages } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { spacesQuery } from '../../lib/wiki';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';
import { Select } from '../../ui/Select';

/** Pages the project writes to the wiki by itself (W-INT-05, W-INT-06, TL-28, E-109). */
export function WikiPagesSettings({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const key = ['project', projectKey, 'wiki-pages'];
  const current = useQuery({
    queryKey: key,
    queryFn: () =>
      unwrap(
        client.GET('/api/v1/projects/{key}/wiki-pages', { params: { path: { key: projectKey } } }),
      ),
  });
  const spaces = useQuery(spacesQuery);
  const [draft, setDraft] = useState<ProjectWikiPages | null>(null);
  useEffect(() => {
    if (current.data) setDraft(current.data);
  }, [current.data]);
  const save = useMutation({
    mutationFn: (body: ProjectWikiPages) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/wiki-pages', {
          params: { path: { key: projectKey } },
          body,
        }),
      ),
    onSuccess: (saved) => queryClient.setQueryData(key, saved),
  });
  if (!draft) return null;
  const toggle = (field: 'retroOnSprintEnd' | 'reportOnSprintEnd' | 'notesOnRelease') => (
    <label className="flex items-center gap-2 text-[13.5px]">
      <input
        type="checkbox"
        checked={draft[field]}
        disabled={!draft.spaceKey}
        onChange={(event) => {
          setDraft({ ...draft, [field]: event.target.checked });
          save.reset();
        }}
      />
      {t(`projectPages.${field}`)}
    </label>
  );
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('projectPages.title')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('projectPages.intro')}</p>
      </div>
      {save.error && <FormError message={save.error.message} />}
      <div className="max-w-[360px]">
        <Select
          label={t('projectPages.space')}
          value={draft.spaceKey ?? ''}
          options={[
            { value: '', label: t('projectPages.off') },
            ...(spaces.data ?? []).map((space) => ({ value: space.key, label: space.name })),
          ]}
          onChange={(event) => {
            setDraft({ ...draft, spaceKey: event.target.value || null });
            save.reset();
          }}
        />
      </div>
      {toggle('retroOnSprintEnd')}
      {toggle('reportOnSprintEnd')}
      {toggle('notesOnRelease')}
      <div className="flex items-center gap-3">
        <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate(draft)}>
          {t('common.save')}
        </Button>
        {save.isSuccess && (
          <span role="status" className="text-[13px] text-[var(--ink-muted)]">
            {t('signIn.saved')}
          </span>
        )}
      </div>
    </section>
  );
}
