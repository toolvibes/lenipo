import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectDetails } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { CheckRow } from '../../ui/Popover';

/** Which custom fields a project uses (E-50); for project administrators. */
export function ProjectFieldsDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fields = (useQuery(trackingMetaQuery).data?.customFields ?? []).filter(
    (field) => !field.archived,
  );
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    if (open) setChosen(project.customFieldIds);
  }, [open, project.customFieldIds]);

  const save = useMutation({
    // Fields keep the order of the instance's list, so all projects show them alike.
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/custom-fields', {
          params: { path: { key: project.key } },
          body: { fieldIds: fields.map((field) => field.id).filter((id) => chosen.includes(id)) },
        }),
      ),
    onSuccess: async (details) => {
      queryClient.setQueryData(projectQuery(project.key).queryKey, details);
      await queryClient.invalidateQueries({ queryKey: ['issue'] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('fields.project.title')}
      description={t('fields.project.intro')}
      width={480}
    >
      <div className="flex flex-col gap-4">
        {save.error && <FormError message={save.error.message} />}
        {fields.length === 0 ? (
          <p className="m-0 text-[var(--ink-muted)]">{t('fields.project.none')}</p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
            <legend className="sr-only">{t('fields.project.title')}</legend>
            {fields.map((field) => (
              <CheckRow
                key={field.id}
                checked={chosen.includes(field.id)}
                detail={t(`fields.types.${field.type}`)}
                onChange={() =>
                  setChosen(
                    chosen.includes(field.id)
                      ? chosen.filter((id) => id !== field.id)
                      : [...chosen, field.id],
                  )
                }
              >
                {field.name}
              </CheckRow>
            ))}
          </fieldset>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending || fields.length === 0}
            onClick={() => save.mutate()}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
