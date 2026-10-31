import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { type AddProjectMemberRequest, PROJECT_ROLES } from '@tasklore/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { client, unwrap } from '../../lib/api';
import { meQuery } from '../../lib/queries';
import { useCurrentProject } from '../../lib/shortcuts';
import { projectMembersQuery, projectQuery, projectWorkflowQuery } from '../../lib/tracking';
import { Select } from '../../ui/Select';
import { TopBar } from '../../ui/TopBar';
import {
  NotificationMatrix,
  notificationChecked,
  notificationColumns,
  notificationSchemeQuery,
  notificationSchemesQuery,
} from '../admin/NotificationSchemes';
import {
  checkedOf,
  columnsOf,
  PermissionMatrix,
  permissionSchemeQuery,
  permissionSchemesQuery,
} from '../admin/PermissionSchemes';
import { securitySchemesQuery } from '../admin/SecuritySchemes';
import { RulesList } from '../automation/RulesList';
import { ComponentsDialog } from '../tracking/ComponentsDialog';
import { ProjectFieldsDialog } from '../tracking/ProjectFieldsDialog';
import { VersionsDialog } from '../tracking/VersionsDialog';
import { RoleMembers } from './RoleMembers';
import { WorkflowEditor } from './WorkflowEditor';

const NAV_ITEM =
  'flex h-[30px] w-full cursor-pointer items-center rounded-[5px] border-0 bg-transparent px-2.5 text-left text-[13px] font-medium text-[var(--ink-muted)] no-underline hover:bg-[var(--selected)] hover:text-[var(--ink)] aria-[current=page]:bg-[var(--selected)] aria-[current=page]:font-semibold aria-[current=page]:text-[var(--ink)]';

/** People and groups per project role (T-PRJ-07, TL-65). */
function Members({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const members = useQuery(projectMembersQuery(projectKey));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['project', projectKey] });
  const remove = useMutation({
    mutationFn: (id: string) =>
      unwrap(
        client.DELETE('/api/v1/projects/{key}/members/{id}', {
          params: { path: { key: projectKey, id } },
        }),
      ),
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: (body: AddProjectMemberRequest) =>
      unwrap(
        client.POST('/api/v1/projects/{key}/members', {
          params: { path: { key: projectKey } },
          body,
        }),
      ),
    onSuccess: async (list) => {
      queryClient.setQueryData(projectMembersQuery(projectKey).queryKey, list);
      await refresh();
    },
  });
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('projectSettings.members')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">{t('projectSettings.membersHelp')}</p>
      </div>
      <RoleMembers
        roles={PROJECT_ROLES}
        defaultRole="developers"
        roleLabel={(role) => t(`projectSettings.roles.${role}`)}
        roleHelp={(role) => t(`projectSettings.roleHelp.${role}`)}
        members={members.data}
        error={remove.error ?? add.error}
        busy={remove.isPending || add.isPending}
        onRemove={(id) => remove.mutate(id)}
        onAdd={(grant) => add.mutateAsync(grant)}
      />
    </section>
  );
}

/**
 * The project's permission scheme (E-82): its name and matrix; global administrators choose
 * another one here, project administrators see which applies.
 */
function Permissions({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const project = useQuery(projectQuery(projectKey));
  const me = useQuery(meQuery);
  const isAdmin = me.data?.globalPermissions.includes('admin') ?? false;
  const schemes = useQuery({ ...permissionSchemesQuery, enabled: isAdmin });
  const current = project.data?.permissionScheme;
  const scheme = useQuery({
    ...permissionSchemeQuery(current?.id ?? ''),
    enabled: isAdmin && !!current,
  });
  const choose = useMutation({
    mutationFn: (schemeId: string) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/permission-scheme', {
          params: { path: { key: projectKey } },
          body: { schemeId },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectKey] }),
  });
  if (!current) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('projectSettings.permissions')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {isAdmin
            ? t('projectSettings.permissionsHelp')
            : t('projectSettings.permissionsAdminOnly')}
        </p>
      </div>
      {choose.error && <p className="m-0 text-[var(--danger)]">{choose.error.message}</p>}
      {isAdmin && schemes.data ? (
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('projectSettings.scheme')}
            value={current.id}
            disabled={choose.isPending}
            options={schemes.data.map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={(event) => choose.mutate(event.target.value)}
          />
          <Link
            to="/admin/permission-schemes/$id"
            params={{ id: current.id }}
            className="pb-2 text-[13px]"
          >
            {t('projectSettings.editScheme')}
          </Link>
        </div>
      ) : (
        <p className="m-0">
          <strong>{current.name}</strong>
        </p>
      )}
      {scheme.data && (
        <PermissionMatrix
          columns={columnsOf(scheme.data.grants)}
          checked={checkedOf(scheme.data.grants)}
        />
      )}
    </section>
  );
}

/** The project's notification scheme (E-83), chosen by global administrators like permissions. */
function Notifications({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const project = useQuery(projectQuery(projectKey));
  const me = useQuery(meQuery);
  const isAdmin = me.data?.globalPermissions.includes('admin') ?? false;
  const schemes = useQuery({ ...notificationSchemesQuery, enabled: isAdmin });
  const current = project.data?.notificationScheme;
  const scheme = useQuery({
    ...notificationSchemeQuery(current?.id ?? ''),
    enabled: isAdmin && !!current,
  });
  const choose = useMutation({
    mutationFn: (schemeId: string) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/notification-scheme', {
          params: { path: { key: projectKey } },
          body: { schemeId },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectKey] }),
  });
  if (!current) return null;
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('projectSettings.notifications')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {isAdmin
            ? t('projectSettings.notificationsHelp')
            : t('projectSettings.permissionsAdminOnly')}
        </p>
      </div>
      {choose.error && <p className="m-0 text-[var(--danger)]">{choose.error.message}</p>}
      {isAdmin && schemes.data ? (
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('projectSettings.notificationScheme')}
            value={current.id}
            disabled={choose.isPending}
            options={schemes.data.map((entry) => ({ value: entry.id, label: entry.name }))}
            onChange={(event) => choose.mutate(event.target.value)}
          />
          <Link
            to="/admin/notification-schemes/$id"
            params={{ id: current.id }}
            className="pb-2 text-[13px]"
          >
            {t('projectSettings.editScheme')}
          </Link>
        </div>
      ) : (
        <p className="m-0">
          <strong>{current.name}</strong>
        </p>
      )}
      {scheme.data && (
        <NotificationMatrix
          columns={notificationColumns(scheme.data.rules)}
          checked={notificationChecked(scheme.data.rules)}
        />
      )}
    </section>
  );
}

/** The project's issue security scheme (TL-13, E-94); global administrators choose it. */
function Security({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const project = useQuery(projectQuery(projectKey));
  const me = useQuery(meQuery);
  const isAdmin = me.data?.globalPermissions.includes('admin') ?? false;
  const schemes = useQuery({ ...securitySchemesQuery, enabled: isAdmin });
  const current = project.data?.securityScheme ?? null;
  const choose = useMutation({
    mutationFn: (schemeId: string | null) =>
      unwrap(
        client.PUT('/api/v1/projects/{key}/security-scheme', {
          params: { path: { key: projectKey } },
          body: { schemeId },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', projectKey] }),
  });
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="tl-heading-md m-0">{t('security.level')}</h2>
        <p className="m-0 text-sm text-[var(--ink-muted)]">
          {t('security.intro')} {!isAdmin && t('security.projectHelp')}
        </p>
      </div>
      {choose.error && <p className="m-0 text-[var(--danger)]">{choose.error.message}</p>}
      {isAdmin && schemes.data ? (
        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('security.scheme')}
            value={current?.id ?? ''}
            disabled={choose.isPending}
            options={[
              { value: '', label: t('security.none') },
              ...schemes.data.map((entry) => ({ value: entry.id, label: entry.name })),
            ]}
            onChange={(event) => choose.mutate(event.target.value || null)}
          />
          {current && (
            <Link
              to="/admin/security-schemes/$id"
              params={{ id: current.id }}
              className="pb-2 text-[13px]"
            >
              {t('projectSettings.editScheme')}
            </Link>
          )}
        </div>
      ) : (
        <p className="m-0">
          <strong>{current?.name ?? t('security.none')}</strong>
        </p>
      )}
      {project.data && project.data.securityLevels.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {project.data.securityLevels.map((level) => (
            <li
              key={level.id}
              className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-2 py-0.5 text-[13px]"
            >
              {level.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Project settings with a sub-navigation (1a S11): the workflow editor, other parts as dialogs. */
export function ProjectSettingsPage({ projectKey }: { projectKey: string }) {
  const { t } = useTranslation();
  const project = useQuery(projectQuery(projectKey));
  const [workflowType, setWorkflowType] = useState<string | null>(null);
  const workflow = useQuery(projectWorkflowQuery(projectKey, workflowType));
  const [dialog, setDialog] = useState<'fields' | 'components' | 'versions' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<
    'workflow' | 'members' | 'permissions' | 'notifications' | 'security' | 'automation'
  >('workflow');
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
          <button
            type="button"
            aria-current={view === 'workflow' ? 'page' : undefined}
            className={NAV_ITEM}
            onClick={() => setView('workflow')}
          >
            {t('projectSettings.workflow')}
          </button>
          {administer && (
            <>
              <button
                type="button"
                aria-current={view === 'members' ? 'page' : undefined}
                className={NAV_ITEM}
                onClick={() => setView('members')}
              >
                {t('projectSettings.members')}
              </button>
              <button
                type="button"
                aria-current={view === 'permissions' ? 'page' : undefined}
                className={NAV_ITEM}
                onClick={() => setView('permissions')}
              >
                {t('projectSettings.permissions')}
              </button>
              <button
                type="button"
                aria-current={view === 'notifications' ? 'page' : undefined}
                className={NAV_ITEM}
                onClick={() => setView('notifications')}
              >
                {t('projectSettings.notifications')}
              </button>
              <button
                type="button"
                aria-current={view === 'security' ? 'page' : undefined}
                className={NAV_ITEM}
                onClick={() => setView('security')}
              >
                {t('security.level')}
              </button>
              <button
                type="button"
                aria-current={view === 'automation' ? 'page' : undefined}
                className={NAV_ITEM}
                onClick={() => setView('automation')}
              >
                {t('automation.title')}
              </button>
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
          {view === 'members' && administer && <Members projectKey={projectKey} />}
          {view === 'permissions' && administer && <Permissions projectKey={projectKey} />}
          {view === 'notifications' && administer && <Notifications projectKey={projectKey} />}
          {view === 'security' && administer && <Security projectKey={projectKey} />}
          {view === 'automation' && administer && <RulesList projectKey={projectKey} />}
          {view === 'workflow' && workflow.data && project.data && (
            <WorkflowEditor
              key={`${workflowType}:${workflow.data.versionId}`}
              projectKey={projectKey}
              projectName={project.data.name}
              issueTypes={project.data.issueTypes}
              onIssueType={(type) => {
                setNotice(null);
                setWorkflowType(type);
              }}
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
