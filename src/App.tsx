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

export function App() {
  const currentUser = useAuthStore((s) => s.currentUser);

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
