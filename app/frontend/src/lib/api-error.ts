/**
 * Normalize FastAPI / Starlette ``{"detail": ...}`` payloads for user-visible messages.
 */

export function parseApiErrorDetail(body: unknown, rawText: string, fallback: string): string {
  const trimmed = rawText.trim();
  if (!body || typeof body !== 'object') {
    if (trimmed && !trimmed.startsWith('<') && trimmed.length < 600) {
      return trimmed.slice(0, 600);
    }
    return fallback;
  }

  const detail = (body as { detail?: unknown }).detail;

  if (typeof detail === 'string') {
    const s = detail.trim();
    return s || fallback;
  }

  if (Array.isArray(detail)) {
    const msgs = detail
      .map((item: unknown) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: string }).msg || '').trim();
        }
        return '';
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join(' ');
  }

  if (detail && typeof detail === 'object' && 'message' in (detail as object)) {
    const m = (detail as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }

  if (trimmed && !trimmed.startsWith('<') && trimmed.length < 600) {
    return trimmed.slice(0, 600);
  }

  return fallback;
}
