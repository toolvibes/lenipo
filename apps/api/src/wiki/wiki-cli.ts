import 'reflect-metadata';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../app.module.js';
import { BoardService } from '../boards/board.service.js';
import { loadConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { createLogger } from '../core/logger.js';
import { createDatabase } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { SearchService } from '../search/search.service.js';
import { IssueService } from '../tracking/issue.service.js';
import { ProjectService } from '../tracking/project.service.js';
import {
  featureCatalog,
  importBacklog,
  parseRoadmap,
  planBacklog,
} from '../tracking/roadmap-backlog.js';
import { VersionService } from '../tracking/version.service.js';
import { exportFolder, importFolder } from './markdown-folder.js';
import { PageService } from './page.service.js';
import { SpaceService } from './space.service.js';

const usage = `Usage:
  wiki export <folder> --space KEY --as EMAIL
  wiki import <folder> --space KEY --as EMAIL [--name "Space name"] [--skip README.md]
  wiki backlog <folder> --project KEY --as EMAIL [--name "Project name"] [--roadmap 07-roadmap.md]

The wiki is the master (E-76): export writes its published pages as Markdown files, import
brings files back as new versions as long as nobody changed the page in between. backlog
creates the epics and stories of the open roadmap phases that are missing (E-77).`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    space: { type: 'string' },
    project: { type: 'string' },
    roadmap: { type: 'string', default: '07-roadmap.md' },
    as: { type: 'string' },
    name: { type: 'string' },
    skip: { type: 'string', multiple: true },
  },
});
const [command, folder] = positionals;
const target = command === 'backlog' ? values.project : values.space;
if (!['import', 'export', 'backlog'].includes(command ?? '') || !folder || !target || !values.as) {
  console.error(usage);
  process.exit(2);
}

// Only the API modules: the running instance does the worker jobs and the live drafts.
const config = { ...loadConfig(), MODE: 'api' as const, LOG_LEVEL: 'warn' as const };
const database = createDatabase(config.DATABASE_URL);
const context = await NestFactory.createApplicationContext(
  AppModule.forRoot({ config, database, logger: createLogger(config) }),
  { logger: false },
);
try {
  const [user] = await database.db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, values.as.toLowerCase()));
  if (!user) throw new Error(`No user with the email ${values.as}`);
  // Acts like the user in the browser, with the user's rights.
  const principal: Principal = { userId: user.id, via: 'session', sessionId: 'wiki-cli' };
  const services = { spaces: context.get(SpaceService), pages: context.get(PageService) };
  if (command === 'backlog') {
    const files = (await readdir(folder)).filter((name) => name.endsWith('.md'));
    const texts = await Promise.all(files.map((name) => readFile(join(folder, name), 'utf8')));
    const roadmap = await readFile(join(folder, values.roadmap), 'utf8');
    const epics = planBacklog(parseRoadmap(roadmap), featureCatalog(texts), {
      fromPhase: 4,
      version: '1.0',
    });
    const result = await importBacklog(
      {
        projects: context.get(ProjectService),
        boards: context.get(BoardService),
        versions: context.get(VersionService),
        issues: context.get(IssueService),
        search: context.get(SearchService),
        spaces: services.spaces,
      },
      principal,
      epics,
      { projectKey: target, projectName: values.name ?? target },
    );
    console.log(`Created ${result.created.length}, already there ${result.existing}.`);
  } else if (command === 'import') {
    const result = await importFolder(services, principal, folder, {
      spaceKey: target,
      spaceName: values.name,
      skip: values.skip,
    });
    console.log(
      `Created ${result.created.length}, updated ${result.updated.length}, unchanged ${result.unchanged.length}.`,
    );
    for (const link of result.unresolved) console.warn(`Link not resolved: ${link}`);
  } else {
    const result = await exportFolder(services, principal, folder, { spaceKey: target });
    console.log(`Wrote ${result.written.length}, removed ${result.removed.length}.`);
    for (const title of result.drafts) console.warn(`Not published, skipped: ${title}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await context.close();
  await database.sql.end({ timeout: 5 });
}
