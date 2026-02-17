import { parseCSV, isValidHttpsUrl } from '../../src/utils/helpers';
import { parseJobCSV } from '../../src/jobQueue/storage';

describe('CSV Parsing', () => {
  describe('parseCSV', () => {
    it('should parse simple CSV', () => {
      const rows = parseCSV('a,b,c\n1,2,3\n4,5,6');
      expect(rows).toEqual([['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']]);
    });

    it('should handle quoted fields with commas', () => {
      const rows = parseCSV('name,url\n"Acme, Inc","https://example.com"');
      expect(rows).toEqual([['name', 'url'], ['Acme, Inc', 'https://example.com']]);
    });

    it('should handle escaped quotes', () => {
      const rows = parseCSV('a\n"He said ""hello"""');
      expect(rows).toEqual([['a'], ['He said "hello"']]);
    });

    it('should handle CRLF line endings', () => {
      const rows = parseCSV('a,b\r\n1,2\r\n3,4');
      expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    });

    it('should skip blank rows', () => {
      const rows = parseCSV('a\n\nb');
      expect(rows).toEqual([['a'], ['b']]);
    });

    it('should handle empty input', () => {
      expect(parseCSV('')).toEqual([]);
    });
  });

  describe('parseJobCSV', () => {
    it('should extract URLs from "url" column', () => {
      const csv = 'url,company\nhttps://example.com/job1,Acme\nhttps://example.com/job2,Corp';
      const result = parseJobCSV(csv);
      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com/job1');
      expect(result[0].company).toBe('Acme');
    });

    it('should handle "job_url" column name (case-insensitive)', () => {
      const csv = 'Job_URL,Role\nhttps://lever.co/job1,Engineer';
      const result = parseJobCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://lever.co/job1');
      expect(result[0].role).toBe('Engineer');
    });

    it('should handle "link" column name', () => {
      const csv = 'Link\nhttps://greenhouse.io/job1';
      const result = parseJobCSV(csv);
      expect(result).toHaveLength(1);
    });

    it('should de-duplicate URLs', () => {
      const csv = 'url\nhttps://example.com/job1\nhttps://example.com/job1\nhttps://example.com/job2';
      const result = parseJobCSV(csv);
      expect(result).toHaveLength(2);
    });

    it('should reject non-https URLs', () => {
      const csv = 'url\nhttp://example.com/job1\nhttps://example.com/job2\nftp://bad.com';
      const result = parseJobCSV(csv);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/job2');
    });

    it('should handle optional columns', () => {
      const csv = 'url,company,role,priority,notes\nhttps://a.com/j,Acme,Eng,1,Important';
      const result = parseJobCSV(csv);
      expect(result[0]).toEqual({
        url: 'https://a.com/j',
        company: 'Acme',
        role: 'Eng',
        priority: 1,
        notes: 'Important',
      });
    });

    it('should return empty for no URL column', () => {
      const csv = 'name,company\nJob1,Acme';
      expect(parseJobCSV(csv)).toEqual([]);
    });

    it('should return empty for header-only CSV', () => {
      const csv = 'url';
      expect(parseJobCSV(csv)).toEqual([]);
    });
  });

  describe('isValidHttpsUrl', () => {
    it('should accept valid https URLs', () => {
      expect(isValidHttpsUrl('https://example.com')).toBe(true);
      expect(isValidHttpsUrl('https://greenhouse.io/jobs/123')).toBe(true);
    });

    it('should reject http URLs', () => {
      expect(isValidHttpsUrl('http://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidHttpsUrl('not a url')).toBe(false);
      expect(isValidHttpsUrl('')).toBe(false);
    });
  });
});
