import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SAML } from '@node-saml/node-saml';
import type { SamlProvider, SaveSamlProviderRequest } from '@toolvibes/shared';
import { and, asc, eq, lt, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DATABASE } from '../core/tokens.js';
import type { DatabaseHandle } from '../db/client.js';
import {
  groupMembers,
  groups,
  samlAssertions,
  samlProviders,
  userIdentities,
  users,
} from '../db/schema/index.js';
import { GroupService, USERS_GROUP } from './group.service.js';

type Row = typeof samlProviders.$inferSelect;

/** What the IdP metadata says: who it is, where to send people, which keys sign. */
export function parseIdpMetadata(xml: string): {
  entityId: string;
  ssoUrl: string;
  certificates: string[];
} {
  const entityId = /entityID="([^"]+)"/.exec(xml)?.[1] ?? '';
  const services = [...xml.matchAll(/<(?:\w+:)?SingleSignOnService\b([^>]*)>/g)].map(
    (match) => match[1] ?? '',
  );
  const redirect =
    services.find((attrs) => attrs.includes('HTTP-Redirect')) ??
    services.find((attrs) => attrs.includes('HTTP-POST'));
  const ssoUrl = redirect ? (/Location="([^"]+)"/.exec(redirect)?.[1] ?? '') : '';
  const signing = xml.replace(
    /<(?:\w+:)?KeyDescriptor\b[^>]*use="encryption"[\s\S]*?<\/(?:\w+:)?KeyDescriptor>/g,
    '',
  );
  const certificates = [
    ...signing.matchAll(/<(?:\w+:)?X509Certificate>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/g),
  ]
    .map((match) => (match[1] ?? '').replace(/\s+/g, ''))
    .filter(Boolean);
  if (!entityId || !ssoUrl || certificates.length === 0) {
    throw new BadRequestException(
      'The metadata needs an entityID, a SingleSignOnService and a signing certificate',
    );
  }
  return { entityId, ssoUrl, certificates: [...new Set(certificates)] };
}

/**
 * SAML 2.0 sign-in (P-USR-05, E-119) with node-saml: signed assertions only, people matched by
 * e-mail or created on first sign-in, groups from an attribute where the group exists.
 */
@Injectable()
export class SamlService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(GroupService) private readonly groupService: GroupService,
  ) {}

  private present(row: Row, base: string): SamlProvider {
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      idpEntityId: row.idpEntityId,
      ssoUrl: row.ssoUrl,
      certificates: row.certificates.length,
      emailAttribute: row.emailAttribute,
      nameAttribute: row.nameAttribute,
      groupsAttribute: row.groupsAttribute,
      createUsers: row.createUsers,
      spEntityId: this.spEntityId(row.id, base),
      acsUrl: this.acsUrl(row.id, base),
      metadataUrl: this.spEntityId(row.id, base),
    };
  }

  private spEntityId = (id: string, base: string) => `${base}/api/v1/auth/saml/${id}/metadata`;
  private acsUrl = (id: string, base: string) => `${base}/api/v1/auth/saml/${id}/acs`;

  async list(base: string): Promise<SamlProvider[]> {
    const rows = await this.database.db
      .select()
      .from(samlProviders)
      .orderBy(asc(samlProviders.name));
    return rows.map((row) => this.present(row, base));
  }

  /** For the sign-in page. */
  async enabled(): Promise<Array<{ id: string; name: string }>> {
    const rows = await this.database.db
      .select({ id: samlProviders.id, name: samlProviders.name })
      .from(samlProviders)
      .where(eq(samlProviders.enabled, true))
      .orderBy(asc(samlProviders.name));
    return rows;
  }

  async save(
    id: string | null,
    request: SaveSamlProviderRequest,
    base: string,
  ): Promise<SamlProvider> {
    const db = this.database.db;
    const parsed = request.metadata.trim() ? parseIdpMetadata(request.metadata) : null;
    const fields = {
      name: request.name,
      enabled: request.enabled,
      emailAttribute: request.emailAttribute,
      nameAttribute: request.nameAttribute,
      groupsAttribute: request.groupsAttribute,
      createUsers: request.createUsers,
      ...(parsed
        ? { idpEntityId: parsed.entityId, ssoUrl: parsed.ssoUrl, certificates: parsed.certificates }
        : {}),
    };
    if (id) {
      const [row] = await db
        .update(samlProviders)
        .set(fields)
        .where(eq(samlProviders.id, id))
        .returning();
      if (!row) throw new NotFoundException('Identity provider not found');
      return this.present(row, base);
    }
    if (!parsed) throw new BadRequestException('Paste the metadata of the identity provider');
    const [row] = await db
      .insert(samlProviders)
      .values({
        id: uuidv7(),
        idpEntityId: parsed.entityId,
        ssoUrl: parsed.ssoUrl,
        certificates: parsed.certificates,
        ...fields,
      })
      .returning();
    return this.present(row as Row, base);
  }

  async delete(id: string): Promise<void> {
    const [row] = await this.database.db
      .delete(samlProviders)
      .where(eq(samlProviders.id, id))
      .returning();
    if (!row) throw new NotFoundException('Identity provider not found');
  }

  private async row(id: string): Promise<Row> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Identity provider not found');
    const [row] = await this.database.db
      .select()
      .from(samlProviders)
      .where(eq(samlProviders.id, id));
    if (!row?.enabled) throw new NotFoundException('Identity provider not found');
    return row;
  }

  private saml(row: Row, base: string): SAML {
    return new SAML({
      entryPoint: row.ssoUrl,
      issuer: this.spEntityId(row.id, base),
      callbackUrl: this.acsUrl(row.id, base),
      idpCert: row.certificates,
      audience: this.spEntityId(row.id, base),
      idpIssuer: row.idpEntityId,
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      // Stateless instances: the signature, audience, recipient and time window protect the flow.
      validateInResponseTo: 'never' as never,
      acceptedClockSkewMs: 60_000,
      identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    });
  }

  async metadata(id: string, base: string): Promise<string> {
    const row = await this.row(id);
    return this.saml(row, base).generateServiceProviderMetadata(null, null);
  }

  /** Where the browser goes to sign in at the IdP; RelayState carries the target path. */
  async startUrl(id: string, base: string, relayState: string): Promise<string> {
    const row = await this.row(id);
    return this.saml(row, base).getAuthorizeUrlAsync(relayState, undefined, {});
  }

  /** Checks the IdP's answer and returns the Lenipo account, creating it where allowed. */
  async acs(id: string, base: string, body: Record<string, string>): Promise<string> {
    const row = await this.row(id);
    const { profile } = await this.saml(row, base).validatePostResponseAsync(body);
    if (!profile) throw new BadRequestException('No sign-in in the response');
    const attributes = profile as unknown as Record<string, unknown>;
    const value = (name: string) => {
      const found = name ? attributes[name] : undefined;
      return Array.isArray(found)
        ? found.map(String)
        : found === undefined || found === null
          ? []
          : [String(found)];
    };
    const email = (
      value(row.emailAttribute)[0] ??
      profile.email ??
      profile.nameID ??
      ''
    ).toLowerCase();
    if (!email.includes('@'))
      throw new BadRequestException('The identity provider sent no e-mail address');
    const name = value(row.nameAttribute)[0] ?? email;
    const db = this.database.db;

    // Each assertion signs in once (TL-44, E-125); node-saml checks signature and time window.
    const xml = (profile as { getAssertionXml?: () => string }).getAssertionXml?.() ?? '';
    const assertionId = /<(?:\w+:)?Assertion\b[^>]*\sID="([^"]+)"/.exec(xml)?.[1];
    if (!assertionId) throw new BadRequestException('The response has no assertion ID');
    await db.delete(samlAssertions).where(lt(samlAssertions.expiresAt, sql`now()`));
    const [fresh] = await db
      .insert(samlAssertions)
      .values({ id: `${row.id}:${assertionId}`, expiresAt: new Date(Date.now() + 86_400_000) })
      .onConflictDoNothing()
      .returning({ id: samlAssertions.id });
    if (!fresh) throw new BadRequestException('This sign-in response was already used');

    // People are bound to the provider and their NameID. The e-mail links an existing account
    // only if it has no password or second factor of its own, so an IdP where people choose
    // their address cannot take over a local or admin account (TL-44, E-125).
    const issuer = `saml:${row.id}`;
    const [linked] = await db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(and(eq(userIdentities.issuer, issuer), eq(userIdentities.subject, profile.nameID)));
    let userId = linked?.userId;
    if (!userId) {
      const [existing] = await db.select().from(users).where(eq(users.email, email));
      if (existing && (existing.passwordHash || existing.totpEnabledAt)) {
        throw new BadRequestException(
          'This account signs in with its password; it cannot be taken over by single sign-on',
        );
      }
      userId = existing?.id;
      if (!userId) {
        if (!row.createUsers) throw new BadRequestException('No account with this e-mail address');
        userId = uuidv7();
        await db.insert(users).values({ id: userId, email, displayName: name, passwordHash: null });
        const [everyone] = await this.groupService.idsByName([USERS_GROUP], db);
        if (everyone)
          await db.insert(groupMembers).values({ groupId: everyone, userId }).onConflictDoNothing();
      }
      await db
        .insert(userIdentities)
        .values({ issuer, subject: profile.nameID, userId, email })
        .onConflictDoNothing();
    }
    const [account] = await db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId));
    if (account?.status !== 'active') throw new BadRequestException('This account is deactivated');
    // Groups named by the IdP join the person to existing Lenipo groups of that name.
    for (const groupName of value(row.groupsAttribute)) {
      const [group] = await db
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.name, groupName));
      if (group)
        await db.insert(groupMembers).values({ groupId: group.id, userId }).onConflictDoNothing();
    }
    return userId;
  }
}
