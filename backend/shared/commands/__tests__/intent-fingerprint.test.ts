import { describe, expect, it } from 'vitest';
import { intentFingerprint } from '../intent-fingerprint';

describe('intentFingerprint', () => {
  it('is stable across object key ordering', () => {
    expect(intentFingerprint({ b: 2, a: { y: 2, x: 1 } }))
      .toBe(intentFingerprint({ a: { x: 1, y: 2 }, b: 2 }));
  });

  it('changes when command intent changes', () => {
    expect(intentFingerprint({ expectedVersion: 0, result: 'supported' }))
      .not.toBe(intentFingerprint({ expectedVersion: 0, result: 'contradicted' }));
  });
});
