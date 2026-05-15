import { describe, expect, it } from 'vitest';
import {
  PUBLIC_HTTP_API_PREFIX,
  resolveApiBase,
  resolveImageBase,
  withPublicApiPrefix,
} from './api-base';

describe('withPublicApiPrefix', () => {
  it('appends /api to a bare API origin', () => {
    expect(withPublicApiPrefix('http://localhost:8000')).toBe('http://localhost:8000/api');
    expect(withPublicApiPrefix('https://api.example.com')).toBe('https://api.example.com/api');
  });

  it('leaves an already-prefixed base unchanged', () => {
    expect(withPublicApiPrefix('http://localhost:8000/api')).toBe('http://localhost:8000/api');
    expect(withPublicApiPrefix('http://localhost:8000/api/')).toBe('http://localhost:8000/api');
  });

  it('keeps relative /api', () => {
    expect(withPublicApiPrefix(PUBLIC_HTTP_API_PREFIX)).toBe('/api');
  });
});

describe('resolveApiBase', () => {
  it('dev always uses proxied /api regardless of VITE_API_URL', () => {
    expect(
      resolveApiBase({
        dev: true,
        viteApiUrl: 'http://localhost:8000',
        pageOrigin: 'http://localhost:5173',
      }),
    ).toBe('/api');
  });

  it('prod with no VITE_API_URL uses /api', () => {
    expect(resolveApiBase({ dev: false, viteApiUrl: '', pageOrigin: 'http://localhost:8000' })).toBe(
      '/api',
    );
  });

  it('prod same-origin (run.sh prod) uses /api even if build baked localhost:8000', () => {
    expect(
      resolveApiBase({
        dev: false,
        viteApiUrl: 'http://localhost:8000',
        pageOrigin: 'http://localhost:8000',
      }),
    ).toBe('/api');
  });

  it('prod via ngrok uses /api when build baked localhost:8000', () => {
    expect(
      resolveApiBase({
        dev: false,
        viteApiUrl: 'http://localhost:8000',
        pageOrigin: 'https://example.ngrok-free.app',
      }),
    ).toBe('/api');
  });

  it('split-origin prod adds /api to bare API host', () => {
    expect(
      resolveApiBase({
        dev: false,
        viteApiUrl: 'https://api.railway.app',
        pageOrigin: 'https://cdn.example.com',
      }),
    ).toBe('https://api.railway.app/api');
  });
});

describe('resolveImageBase', () => {
  it('dev defaults to FastAPI origin for /images', () => {
    expect(resolveImageBase({ dev: true })).toBe('http://localhost:8000');
  });

  it('prod same-origin uses relative images', () => {
    expect(
      resolveImageBase({
        dev: false,
        viteApiUrl: 'http://localhost:8000',
        pageOrigin: 'http://localhost:8000',
      }),
    ).toBe('');
  });

  it('prod ngrok does not point images at viewer localhost', () => {
    expect(
      resolveImageBase({
        dev: false,
        viteApiUrl: 'http://localhost:8000',
        pageOrigin: 'https://example.ngrok-free.app',
      }),
    ).toBe('');
  });
});
