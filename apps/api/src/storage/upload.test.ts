import { describe, expect, it } from 'vitest';
import { cleanFileName, contentTypeOf, sniffImage } from './upload.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('sniffImage', () => {
  it('recognises raster images by their magic bytes', () => {
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImage(Buffer.from('GIF89a......'))).toBe('image/gif');
    expect(sniffImage(Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('image/webp');
  });

  it('never treats SVG or HTML as an image', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImage(Buffer.from('<!doctype html><script>'))).toBeNull();
  });
});

describe('contentTypeOf', () => {
  it('prefers the detected type over the declared one', () => {
    expect(contentTypeOf(PNG, 'text/html')).toEqual({ type: 'image/png', image: true });
    expect(contentTypeOf(Buffer.from('%PDF-1.7'), 'image/png')).toEqual({
      type: 'application/pdf',
      image: false,
    });
  });

  it('keeps a well-formed declared type and replaces anything else', () => {
    expect(contentTypeOf(Buffer.from('a,b'), 'text/csv; charset=utf-8')).toEqual({
      type: 'text/csv',
      image: false,
    });
    expect(contentTypeOf(Buffer.from('<svg'), 'image/png')).toEqual({
      type: 'image/png',
      image: false,
    });
    expect(contentTypeOf(Buffer.from('x'), 'nonsense').type).toBe('application/octet-stream');
  });
});

describe('cleanFileName', () => {
  it('drops paths and control characters', () => {
    expect(cleanFileName('../../etc/notes.txt')).toBe('notes.txt');
    expect(cleanFileName('C:\\Users\\mira\\Bericht März.pdf')).toBe('Bericht März.pdf');
    expect(cleanFileName('a\u0000b\nc.txt')).toBe('abc.txt');
    expect(cleanFileName('')).toBe('datei');
  });
});
