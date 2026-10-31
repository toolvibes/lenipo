import type { AuthProviders, Me, SamlProvider } from '@tasklore/shared';
import { generate } from 'selfsigned';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignedXml } from 'xml-crypto';
import { startTestApp, type TestApp, TestClient } from '../test/harness.js';
import { parseIdpMetadata } from './saml.service.js';
import { SetupService } from './setup.service.js';

let test: TestApp;
let admin: TestClient;
let provider: SamlProvider;
let key = '';
let cert = '';
const IDP = 'https://idp.example.org/saml';

const pemBody = (pem: string) => pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');

function metadata() {
  return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${IDP}">
  <md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data><ds:X509Certificate>${pemBody(cert)}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>
    <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.org/sso"/>
  </md:IDPSSODescriptor>
</md:EntityDescriptor>`;
}

/** A signed SAML response as an IdP would post it. */
function response(email: string, options: { audience?: string; sign?: boolean } = {}) {
  const now = new Date();
  const later = new Date(now.getTime() + 5 * 60_000).toISOString();
  const before = new Date(now.getTime() - 60_000).toISOString();
  const xml = `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_r${Date.now()}" Version="2.0" IssueInstant="${now.toISOString()}" Destination="${provider.acsUrl}"><saml:Issuer>${IDP}</saml:Issuer><samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status><saml:Assertion ID="_a${Date.now()}" Version="2.0" IssueInstant="${now.toISOString()}"><saml:Issuer>${IDP}</saml:Issuer><saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID><saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"><saml:SubjectConfirmationData NotOnOrAfter="${later}" Recipient="${provider.acsUrl}"/></saml:SubjectConfirmation></saml:Subject><saml:Conditions NotBefore="${before}" NotOnOrAfter="${later}"><saml:AudienceRestriction><saml:Audience>${options.audience ?? provider.spEntityId}</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="_s1"><saml:AuthnContext><saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef></saml:AuthnContext></saml:AuthnStatement><saml:AttributeStatement><saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute><saml:Attribute Name="displayName"><saml:AttributeValue>Jonas Berg</saml:AttributeValue></saml:Attribute><saml:Attribute Name="groups"><saml:AttributeValue>saml-team</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion></samlp:Response>`;
  if (options.sign === false) return Buffer.from(xml).toString('base64');
  const signature = new SignedXml({ privateKey: key, publicCert: cert });
  signature.addReference({
    xpath: "//*[local-name(.)='Assertion']",
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/2001/10/xml-exc-c14n#',
    ],
  });
  signature.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
  signature.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  signature.computeSignature(xml, {
    location: {
      reference: "//*[local-name(.)='Assertion']/*[local-name(.)='Issuer']",
      action: 'after',
    },
  });
  return Buffer.from(signature.getSignedXml()).toString('base64');
}

async function post(samlResponse: string) {
  const browser = new TestClient(test.baseUrl);
  const answer = await fetch(`${test.baseUrl}/auth/saml/${provider.id}/acs`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ SAMLResponse: samlResponse, RelayState: '/projects' }),
  });
  browser.cookie = answer.headers.getSetCookie()[0]?.split(';')[0];
  return { status: answer.status, location: answer.headers.get('location'), browser };
}

beforeAll(async () => {
  const pair = await generate([{ name: 'commonName', value: 'idp.example.org' }], {
    keySize: 2048,
  });
  key = pair.private;
  cert = pair.cert;
  test = await startTestApp();
  admin = new TestClient(test.baseUrl);
  const code = await test.app.get(SetupService).issueCode();
  await admin.request('POST', '/setup', {
    token: code,
    instanceName: 'Test',
    admin: { email: 'lena@example.org', displayName: 'Lena Vogt', password: 'ein-langes-passwort' },
  });
  await admin.request('POST', '/admin/groups', { name: 'saml-team', description: '' });
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('SAML 2.0 sign-in (P-USR-05)', () => {
  it('reads IdP metadata and offers the provider on the sign-in page', async () => {
    expect(parseIdpMetadata(metadata())).toMatchObject({
      entityId: IDP,
      ssoUrl: 'https://idp.example.org/sso',
    });
    provider = (
      await admin.request<SamlProvider>('POST', '/admin/saml-providers', {
        name: 'Firmen-SSO',
        metadata: metadata(),
        groupsAttribute: 'groups',
      })
    ).body;
    expect(provider.acsUrl).toMatch(/\/api\/v1\/auth\/saml\/[0-9a-f-]{36}\/acs$/);
    const providers = (
      await new TestClient(test.baseUrl).request<AuthProviders>('GET', '/auth/providers')
    ).body;
    expect(providers.saml).toEqual([{ id: provider.id, name: 'Firmen-SSO' }]);
    const sp = await fetch(`${test.baseUrl}/auth/saml/${provider.id}/metadata`);
    expect(await sp.text()).toContain(provider.acsUrl);
    const start = await fetch(`${test.baseUrl}/auth/saml/${provider.id}/start?redirect=/projects`, {
      redirect: 'manual',
    });
    expect(start.headers.get('location')).toMatch(
      /^https:\/\/idp\.example\.org\/sso\?SAMLRequest=/,
    );
  });

  it('signs people in with a signed assertion, creating the account and joining groups', async () => {
    const { status, location, browser } = await post(response('jonas@example.org'));
    expect([status, location]).toEqual([303, '/projects']);
    const me = (await browser.request<Me>('GET', '/me')).body;
    expect(me).toMatchObject({ email: 'jonas@example.org', displayName: 'Jonas Berg' });
    expect(JSON.stringify(await admin.request('GET', '/admin/groups'))).toContain('saml-team');
  });

  it('refuses unsigned answers and answers for another audience', async () => {
    expect((await post(response('jonas@example.org', { sign: false }))).location).toBe(
      '/login?error=saml',
    );
    expect(
      (await post(response('jonas@example.org', { audience: 'https://andere.example' }))).location,
    ).toBe('/login?error=saml');
  });
});
