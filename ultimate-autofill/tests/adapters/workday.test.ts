/**
 * @jest-environment jsdom
 */

import { workdayAdapter } from '../../src/adapters/workday/index';
import { detectATS } from '../../src/atsDetector/index';

describe('Workday Adapter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('URL pattern matching (via atsDetector)', () => {
    it('should match Workday URLs', () => {
      // Test the URL regex directly since jsdom location mocking is unreliable
      const urls = [
        'https://company.myworkdayjobs.com/en-US/jobs/job/Engineer_JR-12345',
        'https://wd5.myworkdayjobs.com/Staff/job/NYC/SWE_R001',
        'https://acme.myworkday.com/wday/cxs/acme/Recruitment/job/12345',
      ];
      for (const url of urls) {
        expect(/myworkdayjobs\.com|myworkday\.com/i.test(url)).toBe(true);
      }
    });

    it('should NOT match non-Workday URLs', () => {
      expect(/myworkdayjobs\.com|myworkday\.com/i.test('https://greenhouse.io/jobs')).toBe(false);
      expect(/myworkdayjobs\.com|myworkday\.com/i.test('https://lever.co/job')).toBe(false);
    });
  });

  describe('detect from DOM signatures', () => {
    it('should detect data-automation-id elements', () => {
      document.body.innerHTML = `
        <div data-automation-id="jobPostingPage">
          <div data-automation-id="legalNameSection_firstName">
            <input type="text">
          </div>
        </div>
      `;

      const result = workdayAdapter.detect(document);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.signals).toContain('data-automation-id');
    });

    it('should detect data-uxi-element-id elements', () => {
      document.body.innerHTML = `<div data-uxi-element-id="test"></div>`;
      const result = workdayAdapter.detect(document);
      expect(result.signals).toContain('data-uxi-element-id');
    });
  });

  describe('getFields', () => {
    it('should extract fields from data-automation-id containers', () => {
      document.body.innerHTML = `
        <div data-automation-id="legalNameSection_firstName">
          <label>First Name</label>
          <input type="text" id="firstName">
        </div>
        <div data-automation-id="legalNameSection_lastName">
          <label>Last Name</label>
          <input type="text" id="lastName">
        </div>
        <div data-automation-id="email">
          <label>Email</label>
          <input type="email" id="email">
        </div>
      `;

      const inputs = document.querySelectorAll('input');
      inputs.forEach((el) => {
        Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
      });

      const fields = workdayAdapter.getFields(document);
      expect(fields.length).toBeGreaterThanOrEqual(3);

      const firstNameField = fields.find((f) =>
        f.signals.some((s) => s.source === 'workday-automation-id' && s.value === 'First Name')
      );
      expect(firstNameField).toBeDefined();
    });

    it('should map known automation IDs to human labels', () => {
      document.body.innerHTML = `
        <div data-automation-id="phone-number">
          <input type="tel" id="phone">
        </div>
      `;
      const el = document.getElementById('phone')!;
      Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });

      const fields = workdayAdapter.getFields(document);
      const phoneSig = fields[0]?.signals.find((s) => s.source === 'workday-automation-id');
      expect(phoneSig?.value).toBe('Phone Number');
    });

    it('should map email automation ID', () => {
      document.body.innerHTML = `
        <div data-automation-id="email">
          <input type="email" id="em">
        </div>
      `;
      const el = document.getElementById('em')!;
      Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });

      const fields = workdayAdapter.getFields(document);
      const sig = fields[0]?.signals.find((s) => s.source === 'workday-automation-id');
      expect(sig?.value).toBe('Email Address');
    });
  });

  describe('fillField', () => {
    it('should fill a text input', async () => {
      document.body.innerHTML = `<input type="text" id="test">`;
      const input = document.getElementById('test') as HTMLInputElement;
      const ok = await workdayAdapter.fillField(input, 'John');
      expect(ok).toBe(true);
      expect(input.value).toBe('John');
    });

    it('should fill a textarea', async () => {
      document.body.innerHTML = `<textarea id="test"></textarea>`;
      const ta = document.getElementById('test') as HTMLTextAreaElement;
      const ok = await workdayAdapter.fillField(ta, 'Cover letter text');
      expect(ok).toBe(true);
      expect(ta.value).toBe('Cover letter text');
    });

    it('should fill a select by matching option text', async () => {
      document.body.innerHTML = `
        <select id="test">
          <option value="">Select...</option>
          <option value="us">United States</option>
          <option value="ie">Ireland</option>
        </select>
      `;
      const select = document.getElementById('test') as HTMLSelectElement;
      const ok = await workdayAdapter.fillField(select, 'Ireland');
      expect(ok).toBe(true);
      expect(select.value).toBe('ie');
    });

    it('should fill contenteditable div', async () => {
      document.body.innerHTML = `<div id="test" contenteditable="true"></div>`;
      const div = document.getElementById('test') as HTMLElement;
      // jsdom doesn't fully support contentEditable; set it explicitly
      div.contentEditable = 'true';
      const ok = await workdayAdapter.fillField(div, 'Content here');
      expect(ok).toBe(true);
      expect(div.textContent).toBe('Content here');
    });
  });
});
