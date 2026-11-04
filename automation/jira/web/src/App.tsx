import { Navigate, Route, Routes } from 'react-router-dom';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import PlatformPage from './pages/PlatformPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path=":platform" element={<PlatformPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
