import React, { useState } from 'react';
import { ShieldCheck, LogIn } from 'lucide-react';
import { login, type SessionUser } from '../auth';

const DEMO = [
  { u: 'operator', label: 'Operator', does: 'uploads scans, corrects fields' },
  { u: 'verifier', label: 'Verifier', does: 'resolves discrepancies, approves & seals' },
  { u: 'admin', label: 'Admin', does: 'everything' },
];

export const LoginScreen: React.FC<{ onLogin: (u: SessionUser) => void; notice?: string }> = ({ onLogin, notice }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onLogin(await login(username, password)); }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('fetch') ? 'Cannot reach the backend. Is uvicorn running on port 8001?' : msg);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <h1 className="font-bold text-slate-900">भू-लेखा Studio</h1>
            <p className="text-xs text-slate-500">Sign in to the verification workbench</p>
          </div>
        </div>
        {notice && <p className="text-xs bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-2">{notice}</p>}
        <label className="block text-xs font-medium text-slate-700">Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-medium text-slate-700">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>}
        <button disabled={busy || !username || !password}
          className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-sm rounded-lg py-2 flex items-center justify-center gap-2">
          <LogIn className="w-4 h-4" /> {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <a href="/" className="block text-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg py-2 hover:bg-emerald-100">
          नागरिक हैं? अपना खतौनी समझें → Citizen? Understand your land record
        </a>
        <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">Demo accounts (password set in server/.env as DEMO_PASSWORD, default demo@123)</p>
          {DEMO.map((d) => (
            <button type="button" key={d.u} onClick={() => setUsername(d.u)} className="block text-left hover:text-emerald-700">
              <span className="font-mono font-semibold">{d.u}</span> · {d.label} — {d.does}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
};
