/**
 * **Boutique vs Atelier** — the two official experience modes (``User.experience_mode``).
 *
 * The value is **persistent account data**: written on the server (``user_experience.json`` under the API
 * data directory) via ``PUT /api/auth/me``, then returned on login and ``GET /auth/me`` — not a tab-local flag.
 *
 * - **Boutique** — storefront-first: hides the agents hub and power nav. The **corner stylist** auto-connects
 *   the server-provisioned **house** ``sdag_…`` (``GET /api/auth/house-agent-key``) — no Agents page required.
 *   The bubble is always mounted from ``AppChatWidget`` in ``main.tsx`` for both modes (About page only omits it).
 * - **Atelier** — adds the /agents hub, stylist session controls, onboarded agents, and full tool surface on top
 *   of that same house stylist.
 */

export type ExperienceMode = 'boutique' | 'atelier';

export function parseExperienceMode(raw: unknown): ExperienceMode {
  return raw === 'atelier' ? 'atelier' : 'boutique';
}

export function isAtelierExperience(user: { experience_mode?: ExperienceMode | string } | null): boolean {
  return parseExperienceMode(user?.experience_mode) === 'atelier';
}
