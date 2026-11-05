import { describe, expect, it } from 'vitest';
import { loadConfig, runsRole } from './config.js';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base);
    expect(config.MODE).toBe('all');
    expect(config.API_PORT).toBe(4000);
  });

  it('coerces ports from strings', () => {
    expect(loadConfig({ ...base, API_PORT: '8080' }).API_PORT).toBe(8080);
  });

  it('rejects a non-postgres database url', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('treats empty variables as unset, as Docker Compose passes them', () => {
    const config = loadConfig({
      ...base,
      S3_SECRET_ACCESS_KEY: '',
      SMTP_URL: '',
      PUBLIC_URL: ' ',
      MAIL_FROM: '',
    });
    expect(config.S3_SECRET_ACCESS_KEY).toBeUndefined();
    expect(config.SMTP_URL).toBeUndefined();
    expect(config.PUBLIC_URL).toBeUndefined();
    expect(config.MAIL_FROM).toBe('Lenipo <lenipo@localhost>');
  });

  it('still requires S3 settings for STORAGE_DRIVER=s3 when they are empty', () => {
    expect(() =>
      loadConfig({
        ...base,
        STORAGE_DRIVER: 's3',
        S3_ENDPOINT: 'http://s3:9000',
        S3_SECRET_ACCESS_KEY: '',
      }),
    ).toThrow(/STORAGE_DRIVER/);
  });

  it('rejects a missing database url', () => {
    expect(() => loadConfig({})).toThrow(/Invalid configuration/);
  });
});

describe('runsRole', () => {
  it('runs every role in mode all', () => {
    const config = loadConfig(base);
    expect(runsRole(config, 'api') && runsRole(config, 'collab')).toBe(true);
  });

  it('runs only the selected role otherwise', () => {
    const config = loadConfig({ ...base, MODE: 'collab' });
    expect(runsRole(config, 'collab')).toBe(true);
    expect(runsRole(config, 'api')).toBe(false);
  });
});
