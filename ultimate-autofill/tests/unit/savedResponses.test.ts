import { scoreResponse, findMatches, findBestMatch } from '../../src/savedResponses/matcher';
import type { SavedResponse } from '../../src/types/index';
import responses from '../fixtures/responses.json';

// Use the canonical fixture data
const fixtures = responses as SavedResponse[];

describe('Saved Responses Matching', () => {
  describe('scoreResponse', () => {
    it('should give high score for exact question match', () => {
      const firstNameEntry = fixtures.find((r) => r.question.includes('First Name'));
      expect(firstNameEntry).toBeDefined();
      const { score } = scoreResponse('First Name', firstNameEntry!, {});
      expect(score).toBeGreaterThan(0.5);
    });

    it('should give low score for unrelated query', () => {
      const firstNameEntry = fixtures.find((r) => r.question.includes('First Name'));
      expect(firstNameEntry).toBeDefined();
      const { score } = scoreResponse('Company Revenue', firstNameEntry!, {});
      expect(score).toBeLessThan(0.3);
    });

    it('should include explanation string', () => {
      const entry = fixtures[0];
      const { explanation } = scoreResponse('test query', entry, {});
      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(0);
    });

    it('should boost score for domain match', () => {
      const entry: SavedResponse = {
        ...fixtures[0],
        domains: ['example.com'],
      };
      const { score: withDomain } = scoreResponse('First Name', entry, { domain: 'example.com' });
      const { score: without } = scoreResponse('First Name', entry, {});
      expect(withDomain).toBeGreaterThan(without);
    });

    it('should boost score for atsType match', () => {
      const entry: SavedResponse = {
        ...fixtures[0],
        atsTypes: ['workday'],
      };
      const { score: withAts } = scoreResponse('First Name', entry, { atsType: 'workday' });
      const { score: without } = scoreResponse('First Name', entry, {});
      expect(withAts).toBeGreaterThan(without);
    });
  });

  describe('findMatches', () => {
    it('should return top 3 matches by default', () => {
      const matches = findMatches('Email Address', fixtures);
      expect(matches.length).toBeLessThanOrEqual(3);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should sort by score descending', () => {
      const matches = findMatches('First Name', fixtures);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
      }
    });

    it('should return empty for empty query', () => {
      expect(findMatches('', fixtures)).toEqual([]);
    });

    it('should return empty for empty responses', () => {
      expect(findMatches('First Name', [])).toEqual([]);
    });

    it('should respect maxResults', () => {
      const matches = findMatches('Name', fixtures, { maxResults: 1 });
      expect(matches.length).toBeLessThanOrEqual(1);
    });
  });

  describe('findBestMatch', () => {
    it('should return the single best match', () => {
      const match = findBestMatch('Email Address', fixtures);
      expect(match).not.toBeNull();
      expect(match!.response.question.toLowerCase()).toContain('email');
    });

    it('should return null for gibberish', () => {
      const match = findBestMatch('xyzzyqwerty123456', fixtures);
      expect(match).toBeNull();
    });

    it('should match "Phone Number" correctly', () => {
      const match = findBestMatch('Phone Number', fixtures);
      expect(match).not.toBeNull();
      expect(match!.response.question.toLowerCase()).toContain('phone');
    });

    it('should match "Last Name" correctly', () => {
      const match = findBestMatch('Last Name', fixtures);
      expect(match).not.toBeNull();
      expect(match!.response.response).toBe('Okafor');
    });
  });

  describe('fixture data compatibility', () => {
    it('should have the canonical format fields', () => {
      for (const r of fixtures.slice(0, 5)) {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('key');
        expect(r).toHaveProperty('keywords');
        expect(r).toHaveProperty('question');
        expect(r).toHaveProperty('response');
        expect(r).toHaveProperty('appearances');
        expect(r).toHaveProperty('fromAutofill');
        expect(Array.isArray(r.keywords)).toBe(true);
        expect(typeof r.appearances).toBe('number');
        expect(typeof r.fromAutofill).toBe('boolean');
      }
    });

    it('should round-trip via export format', () => {
      const entry = fixtures[0];
      const exported = {
        appearances: entry.appearances,
        fromAutofill: entry.fromAutofill,
        id: entry.id,
        key: entry.key,
        keywords: entry.keywords,
        question: entry.question,
        response: entry.response,
      };
      expect(exported.id).toBe(entry.id);
      expect(exported.keywords).toEqual(entry.keywords);
    });
  });
});
