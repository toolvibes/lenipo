import { Star } from '@phosphor-icons/react';
import type { FavouriteKind } from '@tasklore/shared';
import { useTranslation } from 'react-i18next';
import { useFavourite } from '../../lib/personal';

/** Star toggle for a project or saved filter (P-GEN-05). */
export function FavouriteButton({
  kind,
  refId,
  active,
  name,
}: {
  kind: FavouriteKind;
  refId: string;
  active: boolean;
  name: string;
}) {
  const { t } = useTranslation();
  const favourite = useFavourite();
  const label = active ? t('favourites.remove', { name }) : t('favourites.add', { name });
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={favourite.isPending}
      onClick={(event) => {
        // Inside a card link the star must not open the project.
        event.preventDefault();
        event.stopPropagation();
        favourite.mutate({ kind, ref: refId, on: !active });
      }}
      className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--ink-muted)] hover:bg-[var(--surface-2)] aria-pressed:text-[var(--accent)]"
    >
      <Star size={18} weight={active ? 'fill' : 'regular'} aria-hidden />
    </button>
  );
}
