import { describe, expect, it } from 'vitest';
import {
  defaultVariants, firstFamily, fontFamilyValue, fromGoogleVariant, normalizeCategory, normalizeVariants,
  parseVariant, previewVariant, quoteFamily,
} from '../src/core/variants';

describe('variants', () => {
  it('parses and sorts variant keys', () => {
    expect(parseVariant('700i')).toEqual({ weight: 700, italic: true });
    expect(normalizeVariants(['700', '400i', '400', '400'])).toEqual(['400', '400i', '700']);
  });
  it('maps Google variant names', () => {
    expect(fromGoogleVariant('regular')).toBe('400');
    expect(fromGoogleVariant('italic')).toBe('400i');
    expect(fromGoogleVariant('300italic')).toBe('300i');
    expect(fromGoogleVariant('weird')).toBeNull();
  });
  it('picks preview and default variants', () => {
    expect(previewVariant(['100', '300', '500i'])).toBe('300');
    expect(previewVariant(['400i'])).toBe('400i');
    expect(defaultVariants(['300', '400', '400i', '700', '900'])).toEqual(['400', '400i', '700']);
    expect(defaultVariants(['100', '200'])).toEqual(['200']);
  });
  it('normalises categories from every provider', () => {
    expect(normalizeCategory('Sans Serif')).toBe('sans-serif');
    expect(normalizeCategory('sans-serif')).toBe('sans-serif');
    expect(normalizeCategory('Serif')).toBe('serif');
    expect(normalizeCategory('Slab')).toBe('serif');
    expect(normalizeCategory('Handwritten')).toBe('handwriting');
    expect(normalizeCategory('Script')).toBe('handwriting');
    expect(normalizeCategory('Monospace')).toBe('monospace');
    expect(normalizeCategory('DISPLAY')).toBe('display');
    expect(normalizeCategory('icons')).toBe('other');
    expect(normalizeCategory(undefined)).toBe('other');
  });
  it('builds font-family values safe for HTML attributes', () => {
    expect(quoteFamily('Roboto')).toBe('Roboto');
    expect(quoteFamily('Open Sans')).toBe("'Open Sans'");
    expect(quoteFamily('M PLUS 1p')).toBe("'M PLUS 1p'");
    expect(quoteFamily('Bad"Name')).toBe('BadName');
    expect(fontFamilyValue('Open Sans', 'handwriting')).toBe("'Open Sans', cursive");
    expect(firstFamily('"Open Sans", sans-serif')).toBe('Open Sans');
    expect(firstFamily('')).toBe('');
  });
});
