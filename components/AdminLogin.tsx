import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface AdminLoginProps {
  onLogin: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Senha simples "hardcoded" para facilidade. 
    // Em produção robusta, isso seria verificado no backend.
    if (password === '1234') { 
      onLogin();
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md text-center">
        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-8 h-8 text-slate-700" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Acesso Administrativo</h1>
        <p className="text-slate-500 mb-6 text-sm">Digite a senha para gerenciar as perguntas.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Senha de acesso"
            className={`w-full px-4 py-3 rounded-lg border text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
              error ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-slate-50'
            }`}
            autoFocus
          />
          
          {error && (
            <p className="text-red-500 text-xs font-bold animate-pulse">Senha incorreta</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <span>Entrar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-slate-100">
            <a href="/" className="text-slate-400 hover:text-slate-600 text-xs font-medium">
                ← Voltar para o App
            </a>
        </div>
      </div>
    </div>
  );
};