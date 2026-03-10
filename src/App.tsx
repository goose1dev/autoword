import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.tsx';
import { ProtectedRoute } from './components/auth/ProtectedRoute.tsx';
import { Auth } from './pages/Auth/Auth.tsx';
import { Dashboard } from './pages/Dashboard/Dashboard.tsx';
import { Templates } from './pages/Templates/Templates.tsx';
import { Editor } from './pages/Editor/Editor.tsx';
import { BatchEdit } from './pages/BatchEdit/BatchEdit.tsx';
import { Settings } from './pages/Settings/Settings.tsx';
import { useAuthStore } from './store/useAuthStore.ts';
import { useDocumentStore } from './store/useDocumentStore.ts';

export function App() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const loading = useAuthStore((s) => s.loading);
  const initAuth = useAuthStore((s) => s.initAuth);
  const subscribeToFirestore = useDocumentStore((s) => s.subscribeToFirestore);

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, [initAuth]);

  useEffect(() => {
    if (!loading && currentUser) {
      const unsubscribe = subscribeToFirestore();
      return unsubscribe;
    }
  }, [loading, currentUser, subscribeToFirestore]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', fontSize: '1.2rem' }}>
        Завантаження...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={currentUser ? <Navigate to="/" replace /> : <Auth />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="templates" element={<Templates />} />
        <Route path="editor" element={<Editor />} />
        <Route path="batch" element={<BatchEdit />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
