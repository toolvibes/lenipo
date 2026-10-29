import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { trackingMetaQuery } from '../../lib/tracking';

/**
 * Names and values of history fields in the UI language: system fields by translation,
 * custom fields (`cf:<id>`) by their current name, checkboxes as yes/no (E-50).
 */
export function useFieldLabel() {
  const { t } = useTranslation();
  const fields = useQuery(trackingMetaQuery).data?.customFields ?? [];
  const custom = (field: string) =>
    field.startsWith('cf:') ? fields.find((entry) => entry.id === field.slice(3)) : undefined;
  return {
    name: (field: string) =>
      custom(field)?.name ?? t(`issues.field.${field}` as never, { defaultValue: field }),
    value: (field: string, value: string | null) => {
      if (value === null) return t('issues.none');
      if (custom(field)?.type === 'checkbox') {
        return value === 'true' ? t('common.yes') : t('common.no');
      }
      return value;
    },
  };
}
