import {
  normalize, tokenize, levenshtein, stringSimilarity,
  tokenOverlap, fuzzyTokenMatch, hybridSimilarity, findDuplicates,
} from '../../src/utils/fuzzy';

describe('Fuzzy Matching Utils', () => {
  describe('normalize', () => {
    it('should lowercase and strip punctuation', () => {
      expect(normalize('First Name*')).toBe('first name');
      expect(normalize('Email Address!')).toBe('email address');
    });

    it('should collapse whitespace', () => {
      expect(normalize('  hello   world  ')).toBe('hello world');
    });
  });

  describe('tokenize', () => {
    it('should split into tokens', () => {
      expect(tokenize('First Name')).toEqual(['first', 'name']);
    });
  });

  describe('levenshtein', () => {
    it('should return 0 for equal strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0);
    });

    it('should count single edit', () => {
      expect(levenshtein('hello', 'helo')).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
    });
  });

  describe('stringSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(stringSimilarity('hello', 'hello')).toBe(1);
    });

    it('should return high similarity for similar strings', () => {
      expect(stringSimilarity('First Name', 'First Name*')).toBeGreaterThan(0.8);
    });

    it('should return low similarity for different strings', () => {
      expect(stringSimilarity('abc', 'xyz')).toBeLessThan(0.5);
    });
  });

  describe('tokenOverlap', () => {
    it('should return 1 for identical token sets', () => {
      expect(tokenOverlap(['a', 'b'], ['a', 'b'])).toBe(1);
    });

    it('should return 0 for disjoint sets', () => {
      expect(tokenOverlap(['a'], ['b'])).toBe(0);
    });

    it('should handle partial overlap', () => {
      expect(tokenOverlap(['a', 'b', 'c'], ['a', 'b'])).toBeCloseTo(2 / 3);
    });
  });

  describe('findDuplicates', () => {
    it('should find near-duplicate questions', () => {
      const items = [
        { id: '1', question: 'First Name' },
        { id: '2', question: 'First Name*' },
        { id: '3', question: 'Email Address' },
      ];
      const dups = findDuplicates(items, 0.75);
      expect(dups.length).toBe(1);
      expect(dups[0].idA).toBe('1');
      expect(dups[0].idB).toBe('2');
    });

    it('should return empty for no duplicates', () => {
      const items = [
        { id: '1', question: 'First Name' },
        { id: '2', question: 'Company Revenue' },
      ];
      expect(findDuplicates(items, 0.75)).toEqual([]);
    });
  });
});
