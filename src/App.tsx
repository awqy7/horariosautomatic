import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';

const AUTH_KEY = 'educasched_authed';

export default function App() {
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(AUTH_KEY));

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-color)',
          },
          duration: 3500,
        }}
      />
      <Routes>
        <Route path="/login" element={authed ? <Navigate to="/" /> : <LoginPage onLogin={() => { localStorage.setItem(AUTH_KEY, '1'); setAuthed(true); }} />} />
        <Route path="/*"     element={authed ? <AdminPanel onLogout={() => { localStorage.removeItem(AUTH_KEY); setAuthed(false); }} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
