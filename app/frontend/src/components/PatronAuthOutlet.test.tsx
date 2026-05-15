import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PatronAuthOutlet from './PatronAuthOutlet';

vi.mock('../lib/auth-config', () => ({
  AUTH_ENABLED: false,
}));

describe('PatronAuthOutlet when auth disabled', () => {
  it('blocks sign-in and account routes', () => {
    render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route element={<PatronAuthOutlet />}>
            <Route path="/sign-in" element={<div>Sign in page</div>} />
            <Route path="/account" element={<div>Account page</div>} />
            <Route path="/cart" element={<div>Cart page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
  });
});
