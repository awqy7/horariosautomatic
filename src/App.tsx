import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import AdminPanel from './pages/AdminPanel';

export default function App() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      setAuthed(!!session?.user);
      setChecked(true);
    });
    // Fallback timeout in case Supabase is slow
    const t = setTimeout(() => { if (mounted && !checked) setChecked(true); }, 5000);
    return () => { mounted = false; clearTimeout(t); data.subscription.unsubscribe(); };
  }, []);

  if (!checked) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

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
        <Route path="/login" element={authed ? <Navigate to="/" /> : <LoginPage onLogin={() => setAuthed(true)} />} />
        <Route path="/*"     element={authed ? <AdminPanel onLogout={() => setAuthed(false)} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}
