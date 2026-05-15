/**
 * Regression: floating stylist chat must stay available in **Boutique** and **Atelier**
 * (``AppChatWidget`` must not gate ``<ChatWidget />`` on ``isAtelierExperience``).
 */
import { describe, expect, it } from 'vitest';
import MAIN from './main.tsx?raw';

describe('AppChatWidget contract', () => {
  it('does not hide ChatWidget based on isAtelierExperience', () => {
    const start = MAIN.indexOf('function AppChatWidget');
    expect(start).toBeGreaterThan(-1);
    const end = MAIN.indexOf('function ShopLayout', start);
    expect(end).toBeGreaterThan(start);
    const body = MAIN.slice(start, end);
    expect(body).not.toMatch(/isAtelierExperience/);
  });

  it('renders ChatWidget outside About-only guard', () => {
    const start = MAIN.indexOf('function AppChatWidget');
    const end = MAIN.indexOf('function ShopLayout', start);
    const body = MAIN.slice(start, end);
    expect(body).toMatch(/pathname === '\/about'/);
    expect(body).toMatch(/<ChatWidget\s*\/>/);
  });
});
