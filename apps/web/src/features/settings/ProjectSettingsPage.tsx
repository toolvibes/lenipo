import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrentProject } from '../../lib/shortcuts';
import { projectQuery, projectWorkflowQuery } from '../../lib/tracking';
import { TopBar } from '../../ui/TopBar';
import { ComponentsDialog } from '../tracking/ComponentsDialog';
import { ProjectFieldsDialog } from '../tracking/ProjectFieldsDialog';
import { VersionsDialog } from '../tracking/VersionsDialog';
import { WorkflowEditor } from './WorkflowEditor';

const NAV_ITEM =
  'flex h-[30px] w-full cursor-pointer items-center rounded-[5px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[var(--ink-muted)] no-underline hover:bg-[var(--selected)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--selected)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ink)]';

/** Project settings with a sub-navigation (1a S11): the workflow editor, other parts as dialogs. */
export function ProjectSettingsPage({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  const workflow = useQuery(projectWorkflowQuery(projectKey));
  const [dialog, setDialog] = useState<'fields' | 'components' | 'versions' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useCurrentProject(projectKey);
  const administer = project.data?.permissions.includes('administer') ?? false;
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <main className="flex min-h-full flex-col">
      <TopBar
        crumbs={[
          <Link key="projects" to="/projects">
            {t('projects.title')}
          </Link>,
          <Link key="project" to="/projects/$key" params={{ key: projectKey }}>
            {project.data?.name ?? projectKey}
          </Link>,
          t('projectSettings.title'),
        ]}
      />
      <div className="flex flex-1 flex-wrap">
        <nav
          aria-label={t('projectSettings.sections')}
          className="flex w-full flex-col gap-px border-b border-[var(--border)] px-3 py-6 md:w-[220px] md:border-r md:border-b-0"
        >
          <span aria-current="page" className={NAV_ITEM}>
            {t('projectSettings.workflow')}
          </span>
          {administer && (
            <>
              <button type="button" className={NAV_ITEM} onClick={() => setDialog('fields')}>
                {t('fields.project.button')}
              </button>
              <button type="button" className={NAV_ITEM} onClick={() => setDialog('components')}>
                {t('projects.components.title')}
              </button>
              <button type="button" className={NAV_ITEM} onClick={() => setDialog('versions')}>
                {t('versions.title')}
              </button>
            </>
          )}
        </nav>
        <div className="flex min-w-0 max-w-[820px] flex-1 flex-col gap-3 px-10 py-7">
          {notice && (
            <p role="status" className="m-0 text-[13px] text-[var(--success)]">
              {notice}
            </p>
          )}
          {workflow.data && project.data && (
            <WorkflowEditor
              key={workflow.data.versionId}
              projectKey={projectKey}
              projectName={project.data.name}
              workflow={workflow.data}
              editable={administer}
              onPublished={(version) => setNotice(t('workflow.published', { version }))}
            />
          )}
        </div>
      </div>
      <ComponentsDialog
        projectKey={projectKey}
        open={dialog === 'components'}
        onOpenChange={close}
      />
      <VersionsDialog projectKey={projectKey} open={dialog === 'versions'} onOpenChange={close} />
      {project.data && (
        <ProjectFieldsDialog
          project={project.data}
          open={dialog === 'fields'}
          onOpenChange={close}
        />
      )}
    </main>
  );
}
