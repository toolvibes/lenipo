import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  exportFolder as exportWith,
  FolderConflict,
  importFolder as importWith,
  type WikiPort,
} from '@tasklore/editor/folder';
import type { RichText } from '@tasklore/shared';
import type { Principal } from '../core/http/principal.js';
import type { PageService } from './page.service.js';
import type { SpaceService } from './space.service.js';

export {
  type ExportResult,
  type ImportResult,
  type JsonNode,
  parseMarkdownFile,
  rewriteLinks,
  slug,
} from '@tasklore/editor/folder';

export interface FolderServices {
  spaces: SpaceService;
  pages: PageService;
}

const orNull = <T>(work: Promise<T>): Promise<T | null> =>
  work.catch((error: unknown) => {
    if (error instanceof NotFoundException) return null;
    throw error;
  });

/** The services as the folder sync's view of a wiki (E-76), acting as `principal`. */
function portOf({ spaces, pages }: FolderServices, principal: Principal): WikiPort {
  return {
    space: (key) => orNull(spaces.get(principal, key)),
    createSpace: (input) => spaces.create(principal, { ...input, description: '' }),
    tree: (key) => pages.tree(principal, key),
    page: (id) => orNull(pages.get(principal, id)),
    createPage: (key, input) => pages.create(principal, key, input),
    publish: (id, input) =>
      pages.publish(principal, id, { ...input, content: input.content as RichText }),
  };
}

/** Conflicts answer like other API errors. */
async function conflicts<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof FolderConflict) throw new ConflictException(error.message);
    throw error;
  }
}

export function importFolder(
  services: FolderServices,
  principal: Principal,
  folder: string,
  options: { spaceKey: string; spaceName?: string; skip?: string[] },
) {
  return conflicts(importWith(portOf(services, principal), folder, options));
}

export function exportFolder(
  services: FolderServices,
  principal: Principal,
  folder: string,
  options: { spaceKey: string },
) {
  return conflicts(exportWith(portOf(services, principal), folder, options));
}
