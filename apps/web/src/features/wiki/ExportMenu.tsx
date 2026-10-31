import { Export } from '@phosphor-icons/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { PageExportFormat } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { buttonClass } from '../../ui/Button';

const menuItem =
  'flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[var(--ink)] no-underline outline-none data-[highlighted]:bg-[var(--surface-2)]';

const menuContent =
  'z-50 min-w-56 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-1)] p-1 text-sm shadow-[var(--shadow-float)]';

const locale = (language: string) => (language.startsWith('en') ? 'en' : 'de');

/** PDF (print view), Word, Markdown and HTML of a published page (TL-30, E-111). */
export function PageExportMenu({ spaceKey, pageId }: { spaceKey: string; pageId: string }) {
  const { t, i18n } = useTranslation();
  const [children, setChildren] = useState(false);
  const file = (format: PageExportFormat) =>
    `/api/v1/pages/${pageId}/export/${format}?children=${children}&locale=${locale(i18n.language)}`;
  const print = `/spaces/${spaceKey}/pages/${pageId}/print?auto=true${children ? '&children=true&contents=true' : ''}`;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={buttonClass('ghost', 'sm')}>
        <Export size={16} aria-hidden />
        {t('exports.action')}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4} className={menuContent}>
          <DropdownMenu.Item asChild className={menuItem}>
            <a href={print} target="_blank" rel="noopener">
              {t('exports.pdf')}
            </a>
          </DropdownMenu.Item>
          {(['docx', 'markdown', 'html'] as const).map((format) => (
            <DropdownMenu.Item key={format} asChild className={menuItem}>
              <a href={file(format)} download>
                {t(`exports.${format}`)}
              </a>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.CheckboxItem
            className={menuItem}
            checked={children}
            onCheckedChange={setChildren}
            onSelect={(event) => event.preventDefault()}
          >
            <input type="checkbox" readOnly checked={children} tabIndex={-1} aria-hidden />
            {t('exports.withChildren')}
          </DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A whole space as a ZIP of Markdown or HTML files. */
export function SpaceExportMenu({
  spaceKey,
  className,
}: {
  spaceKey: string;
  /** For the trigger, e.g. to look like the other links of the space sidebar. */
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={className ?? buttonClass('ghost', 'sm')}>
        <Export size={14} aria-hidden />
        {t('exports.space')}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className={menuContent}>
          {(['markdown', 'html'] as const).map((format) => (
            <DropdownMenu.Item key={format} asChild className={menuItem}>
              <a
                href={`/api/v1/spaces/${spaceKey}/export/${format}?locale=${locale(i18n.language)}`}
                download
              >
                {t(format === 'markdown' ? 'exports.spaceMarkdown' : 'exports.spaceHtml')}
              </a>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
