/**
 * Patron ``sdag_…`` API key stored locally for in-browser patron chat
 * (``POST /api/patron/agent/chat/stream``). Never sent to the server except as ``Authorization: Bearer``.
 */
export const SD_PATRON_AGENT_CHAT_STORAGE_KEY = 'sd_patron_agent_chat_api_key';

export function getPatronAgentChatApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(SD_PATRON_AGENT_CHAT_STORAGE_KEY)?.trim();
  return v || null;
}

export function setPatronAgentChatApiKey(key: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (key?.trim()) localStorage.setItem(SD_PATRON_AGENT_CHAT_STORAGE_KEY, key.trim());
  else localStorage.removeItem(SD_PATRON_AGENT_CHAT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('sd:patron-chat-key-changed'));
}
