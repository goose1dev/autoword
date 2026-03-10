import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore.ts';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((s) => s.currentUser);

  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
