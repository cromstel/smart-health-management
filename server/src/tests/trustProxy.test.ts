import { describe, it, expect, afterEach } from 'vitest';
import { trustProxyHops } from '../config/runtime.js';

describe('the proxy hops the API trusts', () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalHops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = originalHops;
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  it('is one hop for a published deployment', () => {
    // The application is published behind a platform proxy that terminates
    // TLS. Without trusting that hop the request looks like plain HTTP, the
    // secure session cookie is never set, and no one can sign in.
    delete process.env.TRUST_PROXY_HOPS;
    process.env.NODE_ENV = 'production';
    expect(trustProxyHops()).toBe(1);
  });

  it('is none for a development machine', () => {
    delete process.env.TRUST_PROXY_HOPS;
    process.env.NODE_ENV = 'development';
    expect(trustProxyHops()).toBe(0);
  });

  it('is what the environment says', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    expect(trustProxyHops()).toBe(2);

    process.env.TRUST_PROXY_HOPS = '0';
    expect(trustProxyHops()).toBe(0);
  });

  it('refuses a value that is not a number of hops', () => {
    process.env.TRUST_PROXY_HOPS = 'one';
    expect(() => trustProxyHops()).toThrow(/TRUST_PROXY_HOPS/);

    process.env.TRUST_PROXY_HOPS = '-1';
    expect(() => trustProxyHops()).toThrow(/TRUST_PROXY_HOPS/);
  });
});
