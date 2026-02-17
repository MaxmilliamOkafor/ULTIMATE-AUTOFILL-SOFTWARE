/**
 * @jest-environment jsdom
 */

import { greenhouseAdapter } from '../../src/adapters/greenhouse/index';

describe('Greenhouse Adapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('URL pattern matching', () => {
    it('should match Greenhouse URLs', () => {
      const urls = [
        'https://boards.greenhouse.io/company/jobs/12345',
        'https://job-boards.greenhouse.io/acme',
        'https://greenhouse.io/apply/123',
      ];
      for (const url of urls) {
        expect(/greenhouse\.io/i.test(url)).toBe(true);
      }
    });

    it('should NOT match non-Greenhouse URLs', () => {
      expect(/greenhouse\.io/i.test('https://lever.co/jobs')).toBe(false);
      expect(/greenhouse\.io/i.test('https://myworkdayjobs.com')).toBe(false);
    });
  });

  describe('detect from DOM', () => {
    it('should detect greenhouse_application container', () => {
      document.body.innerHTML = `<div id="greenhouse_application"><form id="application_form"></form></div>`;

      const result = greenhouseAdapter.detect(document);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals).toContain('greenhouse container');
    });

    it('should detect grnhse_app container', () => {
      document.body.innerHTML = `<div id="grnhse_app"></div>`;

      const result = greenhouseAdapter.detect(document);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect application_form', () => {
      document.body.innerHTML = `<form id="application_form"></form>`;

      const result = greenhouseAdapter.detect(document);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals).toContain('application_form');
    });
  });

  describe('getFields', () => {
    it('should extract fields from greenhouse application form', () => {
      document.body.innerHTML = `
        <div id="greenhouse_application">
          <div class="field">
            <label for="first_name">First Name</label>
            <input type="text" id="first_name" name="job_application[first_name]">
          </div>
          <div class="field">
            <label for="last_name">Last Name</label>
            <input type="text" id="last_name" name="job_application[last_name]">
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" name="job_application[email]">
          </div>
        </div>
      `;

      const inputs = document.querySelectorAll('input');
      inputs.forEach((el) => {
        Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
      });

      const fields = greenhouseAdapter.getFields(document);
      expect(fields.length).toBe(3);

      const fnField = fields.find((f) =>
        f.signals.some((s) => s.source === 'greenhouse-field-key' && s.value === 'First Name')
      );
      expect(fnField).toBeDefined();
    });

    it('should extract data-question attributes', () => {
      document.body.innerHTML = `
        <div id="greenhouse_application">
          <div data-question="Why do you want to work here?">
            <label>Answer</label>
            <textarea id="q1"></textarea>
          </div>
        </div>
      `;
      const ta = document.getElementById('q1')!;
      Object.defineProperty(ta, 'offsetParent', { value: document.body, configurable: true });

      const fields = greenhouseAdapter.getFields(document);
      const qSig = fields[0]?.signals.find((s) => s.source === 'greenhouse-data-question');
      expect(qSig?.value).toBe('Why do you want to work here?');
    });

    it('should map email field key', () => {
      document.body.innerHTML = `
        <div id="greenhouse_application">
          <input type="email" id="em" name="job_application[email]">
        </div>
      `;
      const el = document.getElementById('em')!;
      Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });

      const fields = greenhouseAdapter.getFields(document);
      const sig = fields[0]?.signals.find((s) => s.source === 'greenhouse-field-key');
      expect(sig?.value).toBe('Email Address');
    });
  });

  describe('fillField', () => {
    it('should fill text input', async () => {
      document.body.innerHTML = `<input type="text" id="t">`;
      const input = document.getElementById('t') as HTMLInputElement;
      const ok = await greenhouseAdapter.fillField(input, 'Hello');
      expect(ok).toBe(true);
      expect(input.value).toBe('Hello');
    });

    it('should fill textarea', async () => {
      document.body.innerHTML = `<textarea id="t"></textarea>`;
      const ta = document.getElementById('t') as HTMLTextAreaElement;
      const ok = await greenhouseAdapter.fillField(ta, 'Long answer');
      expect(ok).toBe(true);
      expect(ta.value).toBe('Long answer');
    });

    it('should fill select by matching text', async () => {
      document.body.innerHTML = `
        <select id="s">
          <option value="">--</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      `;
      const sel = document.getElementById('s') as HTMLSelectElement;
      const ok = await greenhouseAdapter.fillField(sel, 'Yes');
      expect(ok).toBe(true);
      expect(sel.value).toBe('yes');
    });

    it('should return false for non-matching select option', async () => {
      document.body.innerHTML = `
        <select id="s">
          <option value="a">Apple</option>
          <option value="b">Banana</option>
        </select>
      `;
      const sel = document.getElementById('s') as HTMLSelectElement;
      const ok = await greenhouseAdapter.fillField(sel, 'Carrot');
      expect(ok).toBe(false);
    });
  });
});
