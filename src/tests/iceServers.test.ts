import { describe, it, expect } from 'vitest';
import { readIceServers } from '@/config/app';

describe('the ICE servers used for real-time connections', () => {
  it('are none when nothing is configured', () => {
    // A connection whose two ends are on the same machine is made from that
    // machine's own addresses and needs no server to say so.
    expect(readIceServers(undefined)).toEqual([]);
    expect(readIceServers('')).toEqual([]);
    expect(readIceServers('   ')).toEqual([]);
  });

  it('are the configured addresses', () => {
    expect(readIceServers('stun:stun.example.org:3478')).toEqual([
      { urls: ['stun:stun.example.org:3478'] },
    ]);
  });

  it('are every configured address', () => {
    expect(readIceServers('stun:a.example.org:3478, turn:b.example.org:3478')).toEqual([
      { urls: ['stun:a.example.org:3478', 'turn:b.example.org:3478'] },
    ]);
  });

  it('ignore the blank entries between commas', () => {
    expect(readIceServers('stun:a.example.org:3478, , stun:b.example.org:3478')).toEqual([
      { urls: ['stun:a.example.org:3478', 'stun:b.example.org:3478'] },
    ]);
  });
});
