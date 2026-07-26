import { describe, expect, it } from 'vitest';
import { MAX_DRIVER_DOCUMENT_BYTES, validateDriverDocument } from './driverDocuments';

function file(type: string, size: number): File {
  return { type, size } as File;
}

describe('driver document validation', () => {
  it('accepts only supported private review formats', () => {
    expect(validateDriverDocument(file('application/pdf', 1024))).toBeNull();
    expect(validateDriverDocument(file('image/jpeg', 1024))).toBeNull();
    expect(validateDriverDocument(file('text/html', 1024))).toBe('type');
  });

  it('rejects oversized files', () => {
    expect(validateDriverDocument(file('image/png', MAX_DRIVER_DOCUMENT_BYTES + 1))).toBe('size');
  });

  it('rejects empty files', () => {
    expect(validateDriverDocument(file('application/pdf', 0))).toBe('empty');
  });
});
