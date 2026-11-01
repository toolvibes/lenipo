import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ReportConfig, ReportKind } from '@toolvibes/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { projectQuery } from '../../lib/tracking';
import { TopBar } from '../../ui/TopBar';
import { ReportView } from './analysis';
import { ReportSettings, reportOf, reportReady } from './ReportSettings';

/**
 * All reports of a project with their settings (TL-21, E-102); the query starts with the
 * project and can be narrowed to a version, an epic or anything TQL can say.
 */
export function ProjectReportsPage({ projectKey, kind }: { projectKey: string; kind: ReportKind }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const project = useQuery(projectQuery(projectKey));
  const [config, setConfig] = useState<ReportConfig>(() =>
    reportOf(kind, { query: `project = ${projectKey}` }),
  );
  // Settings typed into the query apply after a short pause.
  const [applied, setApplied] = useState(config);
  useEffect(() => {
    const timer = setTimeout(() => setApplied(config), 600);
    return () => clearTimeout(timer);
  }, [config]);
  const change = (next: ReportConfig) => {
    setConfig(next);
    if (next.kind !== config.kind) {
      setApplied(next);
      void navigate({
        to: '/projects/$key/reports',
        params: { key: projectKey },
        search: { kind: next.kind },
        replace: true,
      });
    }
  };
  return (
    <>
      <TopBar crumbs={[project.data?.name ?? projectKey, t('analysis.title')]} />
      <main className="flex max-w-[1100px] flex-col gap-5 px-6 py-6 lg:px-10">
        <header className="flex flex-col gap-1">
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.015em]">
            {t(`analysis.kinds.${config.kind}`)}
          </h1>
          <p className="m-0 text-[var(--ink-muted)]">{t('analysis.intro')}</p>
        </header>
        <ReportSettings config={config} onChange={change} projectKey={projectKey} />
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4">
          {reportReady(applied) ? (
            <ReportView config={applied} />
          ) : (
            <p className="m-0 text-[13px] text-[var(--ink-muted)]">{t('analysis.chooseBoard')}</p>
          )}
        </section>
      </main>
    </>
  );
}
