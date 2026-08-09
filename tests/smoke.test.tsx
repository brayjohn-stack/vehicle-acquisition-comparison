// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';

/** Guards against a blank screen: the UI must mount and step through without throwing. */
describe('application smoke test', () => {
  it('renders setup, presents, and advances through every step', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => root.render(<App />));
    expect(host.textContent).toContain('Deal setup');

    const click = async (label: string) => {
      const btn = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
      expect(btn, `button "${label}" not found`).toBeTruthy();
      await act(async () => btn!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    };

    const select = async (value: string) => {
      const el = [...host.querySelectorAll('select')].find((x) =>
        [...x.options].some((o) => o.value === value),
      );
      expect(el, `select with option "${value}" not found`).toBeTruthy();
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
        setter.call(el, value);
        el!.dispatchEvent(new Event('change', { bubbles: true }));
      });
    };

    await select('workbook');
    expect(host.textContent).toContain('1,181.64');

    // The buyer's order sample must tie to the form: 93,900 sale price at 7.25%.
    await select('buyersOrder');
    expect(host.textContent).toContain('6,807.75');

    await click('Present →');
    expect(host.textContent).toContain('How are we acquiring the vehicle?');

    const dots = host.querySelectorAll('.dot').length;
    expect(dots).toBe(6);
    for (let i = 1; i < dots; i++) await click('Next');
    expect(host.textContent).toContain('Estimated equity');
    expect(host.querySelector('.summary-table')).toBeTruthy();

    await click('Edit deal');
    expect(host.textContent).toContain('Deal setup');
  });
});
