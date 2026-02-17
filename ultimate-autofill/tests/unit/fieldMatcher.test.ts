/**
 * @jest-environment jsdom
 */

import { extractFieldSignals, buildFieldQuery, discoverFields, matchFields } from '../../src/fieldMatcher/index';
import type { SavedResponse, FieldInfo } from '../../src/types/index';

const mockResponses: SavedResponse[] = [
  {
    id: '1', key: 'first|name', keywords: ['first', 'name'],
    question: 'First Name', response: 'Max', appearances: 5, fromAutofill: true,
  },
  {
    id: '2', key: 'last|name', keywords: ['last', 'name'],
    question: 'Last Name', response: 'Okafor', appearances: 5, fromAutofill: true,
  },
  {
    id: '3', key: 'email|address', keywords: ['email', 'address'],
    question: 'Email Address', response: 'test@example.com', appearances: 3, fromAutofill: true,
  },
];

describe('Field Matcher', () => {
  describe('extractFieldSignals', () => {
    it('should extract label-for signal', () => {
      document.body.innerHTML = `
        <label for="fname">First Name</label>
        <input id="fname" type="text">
      `;
      const input = document.getElementById('fname') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const labelSig = signals.find((s) => s.source === 'label-for');
      expect(labelSig).toBeDefined();
      expect(labelSig!.value).toBe('First Name');
      expect(labelSig!.weight).toBe(1.0);
    });

    it('should extract placeholder signal', () => {
      document.body.innerHTML = `<input type="text" placeholder="Enter your email">`;
      const input = document.querySelector('input') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const phSig = signals.find((s) => s.source === 'placeholder');
      expect(phSig).toBeDefined();
      expect(phSig!.value).toBe('Enter your email');
    });

    it('should extract aria-label signal', () => {
      document.body.innerHTML = `<input type="text" aria-label="Phone Number">`;
      const input = document.querySelector('input') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const ariaSig = signals.find((s) => s.source === 'aria-label');
      expect(ariaSig).toBeDefined();
      expect(ariaSig!.value).toBe('Phone Number');
    });

    it('should extract name attribute signal', () => {
      document.body.innerHTML = `<input type="text" name="first_name">`;
      const input = document.querySelector('input') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const nameSig = signals.find((s) => s.source === 'name');
      expect(nameSig).toBeDefined();
      expect(nameSig!.value).toBe('first name');
    });

    it('should extract autocomplete signal', () => {
      document.body.innerHTML = `<input type="text" autocomplete="given-name">`;
      const input = document.querySelector('input') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const acSig = signals.find((s) => s.source === 'autocomplete');
      expect(acSig).toBeDefined();
      expect(acSig!.value).toBe('given-name');
      expect(acSig!.weight).toBe(0.85);
    });

    it('should extract wrapping label signal', () => {
      document.body.innerHTML = `<label>Email <input type="email"></label>`;
      const input = document.querySelector('input') as HTMLInputElement;
      const signals = extractFieldSignals(input);
      const wrapSig = signals.find((s) => s.source === 'label-wrap');
      expect(wrapSig).toBeDefined();
      expect(wrapSig!.value).toBe('Email');
    });
  });

  describe('buildFieldQuery', () => {
    it('should use highest-weight signal as primary', () => {
      const fi: FieldInfo = {
        element: document.createElement('input'),
        type: 'text',
        signals: [
          { source: 'label-for', value: 'First Name', weight: 1.0 },
          { source: 'placeholder', value: 'Enter name', weight: 0.7 },
          { source: 'name', value: 'fname', weight: 0.6 },
        ],
      };
      const query = buildFieldQuery(fi);
      expect(query).toContain('First Name');
    });

    it('should return empty string for no signals', () => {
      const fi: FieldInfo = { element: document.createElement('input'), type: 'text', signals: [] };
      expect(buildFieldQuery(fi)).toBe('');
    });
  });

  describe('matchFields', () => {
    it('should match fields to responses', () => {
      document.body.innerHTML = `
        <label for="fn">First Name</label>
        <input id="fn" type="text">
        <label for="ln">Last Name</label>
        <input id="ln" type="text">
      `;

      const fields = discoverFields(document);
      // jsdom offsetParent is always null, so we test manually
      const manualFields: FieldInfo[] = [
        {
          element: document.getElementById('fn') as HTMLElement,
          type: 'text',
          signals: [{ source: 'label-for', value: 'First Name', weight: 1.0 }],
        },
        {
          element: document.getElementById('ln') as HTMLElement,
          type: 'text',
          signals: [{ source: 'label-for', value: 'Last Name', weight: 1.0 }],
        },
      ];

      const matches = matchFields(manualFields, mockResponses);
      expect(matches.length).toBeGreaterThan(0);
      // Both should have matches
      const matchedQuestions = matches.map((m) => m.response.question);
      expect(matchedQuestions).toContain('First Name');
      expect(matchedQuestions).toContain('Last Name');
    });

    it('should sort matches by score descending', () => {
      const manualFields: FieldInfo[] = [
        {
          element: document.createElement('input'),
          type: 'text',
          signals: [{ source: 'label-for', value: 'Email Address', weight: 1.0 }],
        },
      ];
      const matches = matchFields(manualFields, mockResponses);
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
      }
    });

    it('should include explanation', () => {
      const manualFields: FieldInfo[] = [
        {
          element: document.createElement('input'),
          type: 'text',
          signals: [{ source: 'label-for', value: 'First Name', weight: 1.0 }],
        },
      ];
      const matches = matchFields(manualFields, mockResponses);
      expect(matches[0]?.explanation).toBeDefined();
      expect(matches[0].explanation.length).toBeGreaterThan(0);
    });
  });
});
