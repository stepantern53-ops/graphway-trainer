import { expect, test } from 'vitest';
import { readConfig } from '../src/config.js';

const fixture = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://127.0.0.1/graphway_dev', TEST_DATABASE_URL: 'postgresql://127.0.0.1/graphway_test', SESSION_SECRET: 's'.repeat(48), PORT: '3001', WEB_PORT: '5173' };
test('config test runtime selects only graphway_test and isolated loopback port', () => {
  const config = readConfig(fixture);
  expect(config.databaseUrl.endsWith('/graphway_test')).toBe(true);
  expect(config.port).toBe(3002);
  expect(config.allowedOrigins).toEqual(['http://127.0.0.1:3002']);
  expect(readConfig({ ...fixture, TEST_PORT: '3003' }).port).toBe(3003);
});
test('config refuses accidental development database or invalid test port in test mode', () => {
  expect(() => readConfig({ ...fixture, TEST_DATABASE_URL: fixture.DATABASE_URL })).toThrow();
  expect(() => readConfig({ ...fixture, TEST_DATABASE_URL: undefined })).toThrow();
  expect(() => readConfig({ ...fixture, TEST_PORT: '0' })).toThrow();
});
test('config production requires explicit HTTPS origin and never defaults to trusting forwarded headers', () => {
  expect(() => readConfig({ ...fixture, NODE_ENV: 'production' })).toThrow();
  expect(() => readConfig({ ...fixture, NODE_ENV: 'production', APP_ORIGIN: 'http://127.0.0.1:3001' })).toThrow();
  const config = readConfig({ ...fixture, NODE_ENV: 'production', APP_ORIGIN: 'https://graphway.example' });
  expect(config.production).toBe(true);
  expect(config.trustedProxy).toBeUndefined();
});
