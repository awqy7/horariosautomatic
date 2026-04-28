import { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { BookOpen, KeyRound, Loader } from 'lucide-react';

interface Props { onLogin: () => void; }

export default function LoginPage({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message);
      } else {
        toast.success('Bem-vindo ao EducaSched!');
        onLogin();
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem', position: 'relative', overflow: 'hidden' }}>
        {/* Glow */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, background: 'var(--primary)', filter: 'blur(90px)', opacity: 0.4, borderRadius: '50%' }} />

        <div style={{ textAlign: 'center', marginBottom: '2rem', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, borderRadius: 18, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', marginBottom: '1rem', boxShadow: '0 0 24px rgba(59,130,246,0.2)' }}>
            <BookOpen size={34} color="var(--primary)" />
          </div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.3rem', fontWeight: 700 }}>EducaSched</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sistema de Grade Horária Escolar</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</label>
            <input type="email" className="input-field" placeholder="admin@escola.com.br" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Senha</label>
            <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem', height: 48 }}>
            {loading ? <Loader size={18} className="spin" /> : <><KeyRound size={18} /> Acessar Sistema</>}
          </button>
        </form>
      </div>
    </div>
  );
}
