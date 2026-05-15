import { Navigate, Outlet } from 'react-router-dom';
import { AUTH_ENABLED } from '../lib/auth-config';

/**
 * Layout guard for every patron-auth surface (sign-in, account, cart, agents).
 * When ``AUTH_ENABLED`` is false, none of these routes render — redirect home.
 */
export default function PatronAuthOutlet() {
  if (!AUTH_ENABLED) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
