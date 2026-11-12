import { describe, expect, it } from 'bun:test';
import { normalizeCmsLinkHref } from './link';

describe('CMS hyperlink normalization', () => {
  it('accepts complete, relative, anchor, email and phone links', () => {
    expect(normalizeCmsLinkHref('https://www.viasetu.com/tracking')).toBe('https://www.viasetu.com/tracking');
    expect(normalizeCmsLinkHref('/tracking')).toBe('/tracking');
    expect(normalizeCmsLinkHref('#pricing')).toBe('#pricing');
    expect(normalizeCmsLinkHref('mailto:help@viasetu.com')).toBe('mailto:help@viasetu.com');
    expect(normalizeCmsLinkHref('tel:+919999999999')).toBe('tel:+919999999999');
  });

  it('adds HTTPS to a plain hostname and rejects unsafe protocols', () => {
    expect(normalizeCmsLinkHref('www.viasetu.com/blog')).toBe('https://www.viasetu.com/blog');
    expect(normalizeCmsLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeCmsLinkHref('data:text/html,test')).toBeNull();
  });
});
