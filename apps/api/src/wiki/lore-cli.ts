import 'reflect-metadata';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../app.module.js';
import { loadConfig } from '../core/config.js';
import type { Principal } from '../core/http/principal.js';
import { createLogger } from '../core/logger.js';
import { createDatabase } from '../db/client.js';
import { users } from '../db/schema/index.js';
import { exportFolder, importFolder } from './markdown-folder.js';
import { PageService } from './page.service.js';
import { SpaceService } from './space.service.js';

const usage = `Usage:
  lore export <folder> --space KEY --as EMAIL
  lore import <folder> --space KEY --as EMAIL [--name "Space name"] [--skip README.md]

The wiki is the master (E-76): export writes its published pages as Markdown files, import
brings files back as new versions as long as nobody changed the page in between.`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    space: { type: 'string' },
    as: { type: 'string' },
    name: { type: 'string' },
    skip: { type: 'string', multiple: true },
  },
});
const [command, folder] = positionals;
if (!(command === 'import' || command === 'export') || !folder || !values.space || !values.as) {
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
  const principal: Principal = { userId: user.id, via: 'session', sessionId: 'lore-cli' };
  const services = { spaces: context.get(SpaceService), pages: context.get(PageService) };
  if (command === 'import') {
    const result = await importFolder(services, principal, folder, {
      spaceKey: values.space,
      spaceName: values.name,
      skip: values.skip,
    });
    console.log(
      `Created ${result.created.length}, updated ${result.updated.length}, unchanged ${result.unchanged.length}.`,
    );
    for (const link of result.unresolved) console.warn(`Link not resolved: ${link}`);
  } else {
    const result = await exportFolder(services, principal, folder, { spaceKey: values.space });
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
