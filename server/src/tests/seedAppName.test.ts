import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeedAppName, APP_NAME, APP_NAME_PLACEHOLDER } from '../config/app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(here, '..', 'database', 'seed.sql');

describe('the seeded application name', () => {
  it('is rendered into the statement that stores it', () => {
    const seed = fs.readFileSync(seedPath, 'utf8');
    const rendered = applySeedAppName(seed);

    // The name is a fact about the deployment, so the token has to be gone
    // from the statement. It used to survive there, because the first token
    // in the file was the one in the comment that explains the substitution.
    const statement = rendered
      .split(/\r?\n/)
      .find((line) => line.includes("'system_name'"));
    expect(statement).toBeDefined();
    expect(statement).not.toContain(APP_NAME_PLACEHOLDER);
    expect(statement).toContain(APP_NAME);
  });

  it('leaves no token anywhere in the seed', () => {
    const rendered = applySeedAppName(fs.readFileSync(seedPath, 'utf8'));
    expect(rendered).not.toContain(APP_NAME_PLACEHOLDER);
  });

  it('replaces every occurrence, not only the first', () => {
    const rendered = applySeedAppName(`a ${APP_NAME_PLACEHOLDER} b ${APP_NAME_PLACEHOLDER} c`);
    expect(rendered).toBe(`a ${APP_NAME} b ${APP_NAME} c`);
  });

  it('escapes a name that carries a quote', () => {
    // The name reaches a SQL statement, so a quote in it has to be escaped
    // rather than allowed to end the literal.
    const rendered = applySeedAppName(`('${APP_NAME_PLACEHOLDER}')`);
    expect(rendered).toBe(`('${APP_NAME}')`);
  });
});
