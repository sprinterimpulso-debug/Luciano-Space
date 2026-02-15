import React, { useState } from 'react';
import { Send, UserCircle, AlertCircle, X, Loader2 } from 'lucide-react';

interface QuestionFormProps {
  nextId: number;
  onSubmit: (author: string, text: string) => void;
  isSubmitting?: boolean;
}

export const QuestionForm: React.FC<QuestionFormProps> = ({ nextId, onSubmit, isSubmitting = false }) => {
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateInput = (inputText: string): string | null => {
    const trimmed = inputText.trim();

    if (trimmed.length === 0) return null;

    if (trimmed.length < 10) {
      return "Mínimo de 10 letras.";
    }

    if (trimmed.length > 280) {
      return "Máximo de 280 letras.";
    }

    const words = trimmed.split(/\s+/);
    const hasLongWord = words.some(word => word.length > 35);
    if (hasLongWord) {
      return "Palavra muito longa detectada.";
    }

    return null;
  };

  const handleChangeText = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateInput(text);
    if (validationError) {
      setError(validationError);
      return;
    }

    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Call onSubmit
    await onSubmit(author, cleanText);
    
    // Reset form only if successful
    setText('');
    setAuthor('');
    setError(null);
    
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-indigo-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] z-50">
      <div className="max-w-3xl mx-auto px-4 py-3 pb-6 sm:pb-4">
        
        {/* Header do Form */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wide">
              Nova Pergunta #{nextId}
            </span>
          </div>
          <span className={`text-[10px] font-bold ${text.length > 250 ? 'text-amber-600' : 'text-slate-400'}`}>
            {text.length}/280
          </span>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-2 p-2 bg-red-50 border-l-2 border-red-500 rounded-r flex items-start justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-800 text-xs font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          
          {/* Nome */}
          <div className="flex flex-col gap-0.5">
            <label htmlFor="authorName" className="text-xs font-bold text-slate-600 ml-1">
              Seu Nome <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserCircle className="h-4 w-4 text-slate-400" />
              </div>
              <input
                id="authorName"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Ex: Maria Silva"
                maxLength={40}
                disabled={isSubmitting}
                className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
              />
            </div>
          </div>

          {/* Pergunta e Botão */}
          <div className="flex flex-col gap-0.5">
            <label htmlFor="questionText" className="text-xs font-bold text-slate-600 ml-1">
              Sua Dúvida
            </label>
            <div className="flex gap-2 flex-col sm:flex-row">
              <textarea
                id="questionText"
                rows={1}
                value={text}
                onChange={handleChangeText}
                disabled={isSubmitting}
                placeholder="Escreva sua pergunta aqui..."
                className={`flex-1 block w-full px-3 py-2 border rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:bg-white focus:ring-1 resize-none transition-all min-h-[46px] disabled:opacity-60 ${
                  error 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                    : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
              
              <button
                type="submit"
                disabled={!text.trim() || !!error || isSubmitting}
                className="inline-flex sm:w-auto w-full items-center justify-center gap-2 px-6 py-2 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-95 h-full min-h-[46px]"
              >
                {isSubmitting ? (
                   <>
                     <Loader2 className="w-4 h-4 animate-spin" />
                     <span>ENVIANDO</span>
                   </>
                ) : (
                  <>
                    <span>ENVIAR</span>
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
