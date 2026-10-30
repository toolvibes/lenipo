import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectDetails, ProjectFieldSetting } from '@tasklore/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { CheckRow } from '../../ui/Popover';

const PLAIN: ProjectFieldSetting = { required: false, hidden: false, description: null };

/**
 * Which custom fields a project uses (E-50), and how: required, hidden from forms, or with help
 * text of its own (TL-12, E-89); for project administrators.
 */
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
  const [settings, setSettings] = useState<Record<string, ProjectFieldSetting>>({});
  useEffect(() => {
    if (!open) return;
    setChosen(project.customFieldSettings.map((entry) => entry.fieldId));
    setSettings(
      Object.fromEntries(
        project.customFieldSettings.map(({ fieldId, ...setting }) => [fieldId, setting]),
      ),
    );
  }, [open, project.customFieldSettings]);
  const change = (id: string, patch: Partial<ProjectFieldSetting>) =>
    setSettings((current) => ({ ...current, [id]: { ...(current[id] ?? PLAIN), ...patch } }));

  const save = useMutation({
    // Fields keep the order of the instance's list, so all projects show them alike.
    mutationFn: () =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/custom-fields', {
          params: { path: { key: project.key } },
          body: {
            fieldIds: fields.map((field) => field.id).filter((id) => chosen.includes(id)),
            settings: Object.fromEntries(
              chosen.flatMap((id) => (settings[id] ? [[id, settings[id]]] : [])),
            ),
          },
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
      width={560}
    >
      <div className="flex flex-col gap-4">
        {save.error && <FormError message={save.error.message} />}
        {fields.length === 0 ? (
          <p className="m-0 text-[var(--ink-muted)]">{t('fields.project.none')}</p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-0.5 border-0 p-0">
            <legend className="sr-only">{t('fields.project.title')}</legend>
            {fields.map((field) => {
              const setting = settings[field.id] ?? PLAIN;
              return (
                <div key={field.id} className="flex flex-col">
                  <CheckRow
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
                  {chosen.includes(field.id) && (
                    <div className="mb-1.5 ml-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={setting.required}
                          onChange={() =>
                            change(field.id, { required: !setting.required, hidden: false })
                          }
                        />
                        {t('fields.project.required')}
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={setting.hidden}
                          onChange={() =>
                            change(field.id, { hidden: !setting.hidden, required: false })
                          }
                        />
                        {t('fields.project.hidden')}
                      </label>
                      <input
                        aria-label={t('fields.project.help', { name: field.name })}
                        placeholder={field.description || t('fields.project.helpPlaceholder')}
                        value={setting.description ?? ''}
                        maxLength={500}
                        onChange={(event) =>
                          change(field.id, { description: event.target.value || null })
                        }
                        className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[12.5px] text-[var(--ink)]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
