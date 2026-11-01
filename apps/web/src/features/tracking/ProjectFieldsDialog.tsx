import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CustomFieldValue, ProjectDetails, ProjectFieldSetting } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { projectQuery, trackingMetaQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { CheckRow } from '../../ui/Popover';
import { FieldEditor, shownValue } from './CustomFields';

const PLAIN: ProjectFieldSetting = {
  required: false,
  hidden: false,
  description: null,
  issueTypeIds: [],
  optionIds: [],
  defaultValue: null,
  tab: null,
};
const toggled = (list: string[], id: string) =>
  list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

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
  // How chosen defaults show, e.g. a person's name, until the server answers.
  const [shown, setShown] = useState<Record<string, CustomFieldValue | undefined>>({});
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
            <datalist id="project-field-tabs">
              {[...new Set(Object.values(settings).flatMap((entry) => entry.tab ?? []))].map(
                (tab) => (
                  <option key={tab} value={tab} />
                ),
              )}
            </datalist>
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
                      <input
                        aria-label={t('fields.project.tab', { name: field.name })}
                        placeholder={t('fields.project.tabPlaceholder')}
                        list="project-field-tabs"
                        value={setting.tab ?? ''}
                        maxLength={40}
                        onChange={(event) => change(field.id, { tab: event.target.value || null })}
                        className="h-7 w-32 rounded-[var(--radius-sm)] border border-[var(--border-control)] bg-[var(--surface-1)] px-2 text-[12.5px] text-[var(--ink)]"
                      />
                      <details className="w-full">
                        <summary className="cursor-pointer text-[var(--ink-muted)]">
                          {t('fields.project.context')}
                          {(setting.issueTypeIds.length > 0 ||
                            setting.optionIds.length > 0 ||
                            setting.defaultValue !== null) &&
                            ` · ${t('fields.project.contextSet')}`}
                        </summary>
                        <div className="mt-1 flex flex-col gap-1.5 pl-3">
                          <span className="text-[var(--ink-muted)]">
                            {t('fields.project.types')}
                          </span>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {project.issueTypes.map((type) => (
                              <label key={type.id} className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={setting.issueTypeIds.includes(type.id)}
                                  onChange={() =>
                                    change(field.id, {
                                      issueTypeIds: toggled(setting.issueTypeIds, type.id),
                                    })
                                  }
                                />
                                {type.name}
                              </label>
                            ))}
                          </div>
                          {field.options.length > 0 && (
                            <>
                              <span className="text-[var(--ink-muted)]">
                                {t('fields.project.options')}
                              </span>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {field.options
                                  .filter((option) => !option.archived)
                                  .map((option) => (
                                    <label key={option.id} className="flex items-center gap-1.5">
                                      <input
                                        type="checkbox"
                                        checked={setting.optionIds.includes(option.id)}
                                        onChange={() =>
                                          change(field.id, {
                                            optionIds: toggled(setting.optionIds, option.id),
                                          })
                                        }
                                      />
                                      {option.value}
                                    </label>
                                  ))}
                              </div>
                            </>
                          )}
                          <span className="text-[var(--ink-muted)]">
                            {t('fields.project.default')}
                          </span>
                          <FieldEditor
                            field={field}
                            label={t('fields.project.default')}
                            value={
                              shown[field.id] ??
                              shownValue(field, setting.defaultValue ?? undefined)
                            }
                            projectKey={project.key}
                            offered={setting.optionIds}
                            disabled={false}
                            onChange={(value, display) => {
                              change(field.id, { defaultValue: value });
                              setShown((current) => ({
                                ...current,
                                [field.id]: shownValue(field, value, display),
                              }));
                            }}
                          />
                        </div>
                      </details>
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
