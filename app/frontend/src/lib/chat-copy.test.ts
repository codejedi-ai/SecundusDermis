import { describe, expect, it } from 'vitest';
import { userFacingChatSendError } from './chat-copy';

describe('userFacingChatSendError', () => {
  it('maps fetch failures to a reachability hint', () => {
    expect(userFacingChatSendError(new Error('Failed to fetch'))).toContain('Could not reach the API');
  });

  it('maps 401/403 to key guidance', () => {
    expect(userFacingChatSendError(new Error('Stream failed: 401 Unauthorized'))).toContain('AI agents');
  });

  it('maps 503 to no default agent', () => {
    expect(userFacingChatSendError(new Error('Stream failed: 503 Service Unavailable'))).toBe(
      'No default agent selected.',
    );
  });
});
