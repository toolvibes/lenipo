import { Kanban, Plus } from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import type { BoardType } from '@toolvibes/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { boardsQuery } from '../../lib/boards';
import { recentQuery } from '../../lib/personal';
import { projectsQuery } from '../../lib/tracking';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { FormError } from '../../ui/FormError';
import { TextField } from '../../ui/TextField';
import { FavouriteButton } from '../personal/FavouriteButton';

function CreateBoardDialog({
  open,
  onOpenChange,
  projectKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectKey?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const [name, setName] = useState('');
  const [project, setProject] = useState(projectKey ?? '');
  const [type, setType] = useState<BoardType>('kanban');
  useEffect(() => {
    if (!open) return;
    setName('');
    setType('kanban');
    setProject(projectKey ?? projects.data?.[0]?.key ?? '');
  }, [open, projectKey, projects.data]);

  const create = useMutation({
    mutationFn: () =>
      unwrap(client.POST('/api/v1/boards', { body: { name, projectKey: project, type } })),
    onSuccess: async (board) => {
      await queryClient.invalidateQueries({ queryKey: ['boards'] });
      onOpenChange(false);
      await navigate({ to: '/boards/$id', params: { id: board.id }, search: {} });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && project) create.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('boards.create')} width={480}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {create.error && <FormError message={create.error.message} />}
        <TextField
          label={t('boards.name')}
          value={name}
          required
          autoFocus
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="flex flex-col gap-1.5">
          <span className="tl-label text-[var(--ink-muted)]">{t('boards.project')}</span>
          <select
            value={project}
            required
            onChange={(event) => setProject(event.target.value)}
            className="h-[var(--control-md)] rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2"
          >
            {projects.data?.map((entry) => (
              <option key={entry.id} value={entry.key}>
                {entry.name} ({entry.key})
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--ink-muted)]">{t('boards.projectHelp')}</span>
        </label>
        <fieldset className="m-0 flex gap-4 border-0 p-0">
          <legend className="tl-label mb-1.5 text-[var(--ink-muted)]">{t('boards.type')}</legend>
          {(['kanban', 'scrum'] as const).map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="radio"
                name="board-type"
                checked={type === option}
                onChange={() => setType(option)}
              />
              {t(`boards.types.${option}`)}
            </label>
          ))}
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={create.isPending || !name.trim() || !project}
          >
            {t('boards.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** All boards the caller can see, grouped by their project (E-53). */
export function BoardsPage() {
  const { t } = useTranslation();
  const boards = useQuery(boardsQuery());
  const recent = useQuery(recentQuery(20));
  const [creating, setCreating] = useState(false);
  // Starred boards first, then the rest in the server's order (TL-6).
  const sorted = [...(boards.data ?? [])].sort((a, b) => Number(b.favourite) - Number(a.favourite));
  const recentBoards = (recent.data ?? []).filter((item) => item.kind === 'board').slice(0, 5);

  return (
    <main className="flex flex-col gap-4 px-6 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="tl-heading-xl">{t('boards.title')}</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden />
          {t('boards.create')}
        </Button>
      </header>
      {boards.data?.length === 0 && (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[var(--ink-muted)]">
          {t('boards.empty')}
        </p>
      )}
      {recentBoards.length > 0 && (
        <nav aria-label={t('boards.recentlyViewed')} className="flex flex-wrap items-center gap-2">
          <span className="tl-label text-[var(--ink-muted)]">{t('boards.recentlyViewed')}</span>
          {recentBoards.map((item) => (
            <Link
              key={item.ref}
              to="/boards/$id"
              params={{ id: item.ref }}
              search={{}}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-2.5 py-0.5 text-[13px] text-[var(--ink)] no-underline hover:border-[var(--accent)]"
            >
              {item.name}
              <span className="text-[var(--ink-muted)]"> · {item.projectKey}</span>
            </Link>
          ))}
        </nav>
      )}
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((board) => (
          <li key={board.id}>
            <Link
              to="/boards/$id"
              params={{ id: board.id }}
              search={{}}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-4 text-[var(--ink)] no-underline hover:border-[var(--accent)]"
            >
              <Kanban size={24} aria-hidden className="shrink-0 text-[var(--accent)]" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{board.name}</span>
                <span className="truncate text-xs text-[var(--ink-muted)]">
                  {board.project.name} · {t(`boards.types.${board.type}`)}
                </span>
              </span>
              <FavouriteButton
                kind="board"
                refId={board.id}
                active={board.favourite}
                name={board.name}
              />
            </Link>
          </li>
        ))}
      </ul>
      <CreateBoardDialog open={creating} onOpenChange={setCreating} />
    </main>
  );
}
