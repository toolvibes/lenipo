import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../lib/api';
import { projectQuery, projectsQuery } from '../lib/tracking';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { FormError } from '../ui/FormError';
import { Select } from '../ui/Select';

interface Line {
  text: string;
  /** Where the issue macro goes: the end of the line's text block. */
  at: number;
  use: boolean;
}

/** One line per text block, list item or table row (first cell) in the selection. */
function linesOf(editor: Editor): Line[] {
  const { from, to } = editor.state.selection;
  const lines: Line[] = [];
  editor.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'tableRow') {
      const cell = node.firstChild;
      const block = cell?.firstChild;
      if (cell && block) {
        // Inside the row: past the row, cell and block openings.
        lines.push({ text: block.textContent.trim(), at: pos + 3 + block.content.size, use: true });
      }
      return false;
    }
    if (node.isTextblock) {
      lines.push({ text: node.textContent.trim(), at: pos + 1 + node.content.size, use: true });
      return false;
    }
    return true;
  });
  return lines.filter((line) => line.text);
}

/** Issues from selected lines of a wiki page (W-INT-02, TL-28, E-109). */
export function IssuesFromText({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [projectKey, setProjectKey] = useState('');
  const [issueType, setIssueType] = useState('');
  const projects = useQuery({ ...projectsQuery, enabled: open });
  const project = useQuery({ ...projectQuery(projectKey), enabled: open && !!projectKey });
  useEffect(() => {
    if (open) setLines(linesOf(editor));
  }, [open, editor]);
  const types = (project.data?.issueTypes ?? []).filter((type) => type.hierarchyLevel === 0);
  const create = useMutation({
    mutationFn: async () => {
      const keys: { at: number; key: string }[] = [];
      for (const line of lines.filter((entry) => entry.use)) {
        const issue = await unwrap(
          client.POST('/api/v1/issues', {
            body: {
              projectKey,
              issueType: issueType || types[0]?.key || 'task',
              summary: line.text.slice(0, 255),
              description: {
                markdown: t('issuesFromText.fromPage', { url: window.location.href }),
              },
            },
          }),
        );
        keys.push({ at: line.at, key: issue.key });
      }
      return keys;
    },
    onSuccess: async (keys) => {
      // From the end backwards, so earlier positions stay valid.
      const chain = editor.chain();
      for (const { at, key } of [...keys].sort((a, b) => b.at - a.at)) {
        chain.insertContentAt(at, [
          { type: 'text', text: ' ' },
          { type: 'issue', attrs: { key } },
        ]);
      }
      chain.run();
      await queryClient.invalidateQueries({ queryKey: ['search'] });
      onOpenChange(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('issuesFromText.title')}
      description={t('issuesFromText.help')}
      width={560}
    >
      <div className="flex flex-col gap-3">
        {create.error && <FormError message={create.error.message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label={t('issuesFromText.project')}
            value={projectKey}
            options={[
              { value: '', label: t('issuesFromText.chooseProject') },
              ...(projects.data ?? []).map((entry) => ({
                value: entry.key,
                label: `${entry.name} (${entry.key})`,
              })),
            ]}
            onChange={(event) => {
              setProjectKey(event.target.value);
              setIssueType('');
            }}
          />
          <Select
            label={t('issuesFromText.type')}
            value={issueType}
            options={types.map((type) => ({ value: type.key, label: type.name }))}
            onChange={(event) => setIssueType(event.target.value)}
          />
        </div>
        {lines.length === 0 ? (
          <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('issuesFromText.empty')}</p>
        ) : (
          <ul className="m-0 flex max-h-72 list-none flex-col gap-1 overflow-y-auto p-0">
            {lines.map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
              <li key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={line.use}
                  aria-label={t('issuesFromText.include')}
                  onChange={(event) =>
                    setLines(
                      lines.map((entry, at) =>
                        at === index ? { ...entry, use: event.target.checked } : entry,
                      ),
                    )
                  }
                />
                <input
                  value={line.text}
                  maxLength={255}
                  aria-label={t('issuesFromText.summary')}
                  onChange={(event) =>
                    setLines(
                      lines.map((entry, at) =>
                        at === index ? { ...entry, text: event.target.value } : entry,
                      ),
                    )
                  }
                  className="h-8 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[13px]"
                />
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={
              !projectKey || create.isPending || !lines.some((line) => line.use && line.text.trim())
            }
            onClick={() => create.mutate()}
          >
            {t('issuesFromText.create', { count: lines.filter((line) => line.use).length })}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
