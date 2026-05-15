import { Navigate } from 'react-router-dom';
import { AUTH_ENABLED } from '../lib/auth-config';

/** When sign-in is disabled, auth routes redirect home instead of rendering forms. */
export default function AuthPagesGate({ children }: { children: React.ReactNode }) {
  if (!AUTH_ENABLED) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
