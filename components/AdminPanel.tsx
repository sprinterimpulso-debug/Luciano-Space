import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Question, QuestionStatus } from '../types';
import { 
  Loader2, LogOut, Trash2, Save, CheckCircle2, Lock, Clock, PlayCircle, Sparkles, Filter, Send
} from 'lucide-react';

const SELECTED_QUESTIONS_KEY = 'admin_selected_questions';
const SELECTION_TARGET_KEY = 'admin_selection_target';

const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

type SelectionTarget = 'LIVE_GRATUITA' | 'DESPERTOS';

const getSelectionTargetLabel = (target: SelectionTarget): string =>
  target === 'LIVE_GRATUITA' ? 'Live Gratuita' : 'Despertos';

export const AdminPanel: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<QuestionStatus | 'ALL'>('ALL');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget>('LIVE_GRATUITA');
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);
  
  // Form States
  const [editAnswer, setEditAnswer] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editStatus, setEditStatus] = useState<QuestionStatus>(QuestionStatus.PENDING);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SELECTED_QUESTIONS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setSelectedIds(parsed.filter((id): id is number => Number.isInteger(id)));
      }
    } catch (error) {
      console.error('Erro ao carregar seleção local:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SELECTED_QUESTIONS_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

  useEffect(() => {
    try {
      const storedTarget = localStorage.getItem(SELECTION_TARGET_KEY);
      if (storedTarget === 'LIVE_GRATUITA' || storedTarget === 'DESPERTOS') {
        setSelectionTarget(storedTarget);
      }
    } catch (error) {
      console.error('Erro ao carregar tipo de seleção:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SELECTION_TARGET_KEY, selectionTarget);
  }, [selectionTarget]);

  useEffect(() => {
    if (questions.length === 0) return;

    const validIds = new Set(questions.map((q) => q.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [questions]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const mapped: Question[] = data.map((item: any) => ({
        id: item.id,
        author: item.author,
        text: item.text,
        status: item.status as QuestionStatus,
        answer: item.answer || '',
        videoUrl: item.video_url || '',
        timestamp: new Date(item.created_at)
      }));
      setQuestions(mapped);
    }
    setIsLoading(false);
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setEditAnswer(q.answer || '');
    setEditVideoUrl(q.videoUrl || '');
    setEditStatus(q.status);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditAnswer('');
    setEditVideoUrl('');
  };

  const handleSave = async (id: number) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          answer: editAnswer,
          video_url: editVideoUrl,
          status: editStatus
        })
        .eq('id', id);

      if (!error) {
        setQuestions(prev => prev.map(q => 
          q.id === id 
            ? { ...q, answer: editAnswer, videoUrl: editVideoUrl, status: editStatus } 
            : q
        ));
        setEditingId(null);
      } else {
        alert('Erro ao salvar');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja EXCLUIR essa pergunta?')) return;
    
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (!error) {
      setQuestions(prev => prev.filter(q => q.id !== id));
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedQuestions = useMemo(
    () => questions.filter((question) => selectedSet.has(question.id)),
    [questions, selectedSet]
  );

  const filteredQuestions = questions.filter(q => {
    const passesStatusFilter = filter === 'ALL' || q.status === filter;
    const passesSelectedFilter = !showSelectedOnly || selectedSet.has(q.id);
    return passesStatusFilter && passesSelectedFilter;
  });

  const selectedCount = selectedIds.length;

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    ));
  };

  const sendSelectedToTelegram = async () => {
    if (selectedQuestions.length === 0) {
      alert('Selecione ao menos uma pergunta para enviar.');
      return;
    }

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      alert('Configuração do Telegram ausente. Defina VITE_TELEGRAM_BOT_TOKEN e VITE_TELEGRAM_CHAT_ID.');
      return;
    }

    const selectionLabel = getSelectionTargetLabel(selectionTarget);
    const dateLabel = new Date().toLocaleDateString('pt-BR');
    const headerLines = [
      `Data: ${dateLabel}`,
      `Destino: ${selectionLabel}`,
      `Total de perguntas: ${selectedQuestions.length}`,
      '',
      'Perguntas selecionadas:'
    ];
    const headerText = headerLines.join('\n');
    const questionLines = selectedQuestions.map((question, index) => {
      const author = question.author?.trim() || 'Anônimo';
      const normalizedText = question.text.replace(/\s+/g, ' ').trim();
      return `${index + 1}. [#${question.id}] ${author}: ${normalizedText}`;
    });

    const messages: string[] = [];
    let currentBody = '';
    const maxMessageLength = 3800;

    for (const line of questionLines) {
      const candidateBody = currentBody ? `${currentBody}\n${line}` : line;
      const candidate = `${headerText}\n${candidateBody}`;
      if (candidate.length <= maxMessageLength) {
        currentBody = candidateBody;
        continue;
      }

      if (currentBody) {
        messages.push(`${headerText}\n${currentBody}`);
      }

      if (`${headerText}\n${line}`.length > maxMessageLength) {
        messages.push(`${headerText}\n${line.slice(0, maxMessageLength - headerText.length - 1)}`);
        currentBody = '';
        continue;
      }

      currentBody = line;
    }

    if (currentBody) {
      messages.push(`${headerText}\n${currentBody}`);
    }

    setIsSendingToTelegram(true);
    try {
      for (const text of messages) {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            disable_web_page_preview: true
          })
        });

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.description || 'Falha ao enviar mensagem para o Telegram.');
        }
      }

      alert(`Seleção enviada para o Telegram em ${messages.length} mensagem(ns).`);
    } catch (error) {
      console.error(error);
      alert('Não foi possível enviar para o Telegram. Tente novamente.');
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  const pendingCount = questions.filter(q => q.status === QuestionStatus.PENDING).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Admin Header */}
      <header className="bg-violet-900 text-white p-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-300" />
              Painel do Admin
            </h1>
            <p className="text-xs text-indigo-200">Gerencie as perguntas do app</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-indigo-200 uppercase">Pendentes</p>
              <p className="text-xl font-bold text-amber-400 leading-none">{pendingCount}</p>
            </div>
            <a href="/" className="bg-violet-800 hover:bg-violet-700 p-2 rounded-lg transition-colors" title="Sair">
              <LogOut className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4">
        
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
           <button 
             onClick={() => setFilter('ALL')}
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
           >
             Todas ({questions.length})
           </button>
           <button 
             onClick={() => setFilter(QuestionStatus.PENDING)}
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${filter === QuestionStatus.PENDING ? 'bg-yellow-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
           >
             <Clock className="w-3.5 h-3.5" /> Pendentes
           </button>
           <button 
             onClick={() => setFilter(QuestionStatus.ANSWERED)}
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${filter === QuestionStatus.ANSWERED ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
           >
             <CheckCircle2 className="w-3.5 h-3.5" /> Respondidas
           </button>
           <button 
             onClick={() => setFilter(QuestionStatus.PREMIUM)}
             className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${filter === QuestionStatus.PREMIUM ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
           >
             <Sparkles className="w-3.5 h-3.5" /> Despertos
           </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {/* List */}
        <div className="space-y-4">
          {filteredQuestions.map((q) => (
            <div key={q.id} className="flex items-start gap-3">
              <label className="pt-5 pl-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSet.has(q.id)}
                  onChange={() => toggleSelected(q.id)}
                  aria-label={`Selecionar pergunta ${q.id}`}
                  className="h-5 w-5 accent-emerald-600 rounded border-slate-300"
                />
              </label>

              <div 
                className={`flex-1 bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${
                  editingId === q.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'
                } ${selectedSet.has(q.id) ? 'ring-2 ring-emerald-500 border-emerald-500' : ''}`}
              >
                {/* Card Header (Always visible) */}
                <div className="p-4 bg-slate-50 flex justify-between items-start border-b border-slate-100">
                  <div>
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400">#{q.id}</span>
                        <span className="text-xs font-semibold text-slate-700">{q.author || 'Anônimo'}</span>
                        <span className="text-[10px] text-slate-400">• {q.timestamp.toLocaleDateString()}</span>
                     </div>
                     <p className="font-medium text-slate-900">{q.text}</p>
                  </div>
                  
                  {editingId !== q.id && (
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase max-w-[120px] truncate ${
                         q.status === QuestionStatus.PENDING ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                         q.status === QuestionStatus.ANSWERED ? 'bg-violet-50 text-violet-700 border-violet-200' :
                         'bg-amber-50 text-amber-700 border-amber-200'
                       }`}>
                         {q.status === QuestionStatus.PREMIUM ? 'Despertos' : 
                          q.status === QuestionStatus.ANSWERED ? 'Respondida' : 'Pendente'}
                       </span>
                       <button 
                         onClick={() => handleEdit(q)}
                         className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors"
                       >
                         Editar
                       </button>
                    </div>
                  )}
                </div>

                {/* Edit Mode */}
                {editingId === q.id && (
                  <div className="p-4 bg-indigo-50/50 animate-fade-in">
                    <div className="grid gap-4">
                      
                      {/* Status Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Status da Pergunta</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditStatus(QuestionStatus.PENDING)}
                            className={`flex-1 py-2 text-sm font-bold rounded border ${editStatus === QuestionStatus.PENDING ? 'bg-yellow-100 border-yellow-400 text-yellow-800' : 'bg-white border-slate-300 text-slate-500'}`}
                          >
                            Pendente
                          </button>
                          <button
                            onClick={() => setEditStatus(QuestionStatus.ANSWERED)}
                            className={`flex-1 py-2 text-sm font-bold rounded border ${editStatus === QuestionStatus.ANSWERED ? 'bg-violet-100 border-violet-400 text-violet-800' : 'bg-white border-slate-300 text-slate-500'}`}
                          >
                            Respondida
                          </button>
                          <button
                            onClick={() => setEditStatus(QuestionStatus.PREMIUM)}
                            className={`flex-1 py-2 text-sm font-bold rounded border ${editStatus === QuestionStatus.PREMIUM ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-slate-300 text-slate-500'}`}
                          >
                            Despertos (Pago)
                          </button>
                        </div>
                      </div>

                      {/* Answer Text */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Resposta em Texto</label>
                        <textarea
                          rows={5}
                          className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white text-slate-900"
                          placeholder="Digite a resposta aqui..."
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                        />
                      </div>

                      {/* Youtube Link */}
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase flex items-center gap-1">
                          <PlayCircle className="w-3 h-3" /> Link do YouTube (Opcional)
                        </label>
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white text-slate-900"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={editVideoUrl}
                          onChange={(e) => setEditVideoUrl(e.target.value)}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2">
                        <button 
                          onClick={() => handleDelete(q.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </button>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={handleCancel}
                            className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-bold text-sm"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleSave(q.id)}
                            disabled={isSaving}
                            className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow-md flex items-center gap-2"
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredQuestions.length === 0 && (
             <div className="text-center py-12 text-slate-400">
               <p>Nenhuma pergunta encontrada neste filtro.</p>
             </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {selectedCount > 0 && (
          <div className="w-[300px] max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-xl shadow-lg p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500 mb-2">Enviar Selecionados Para</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => setSelectionTarget('LIVE_GRATUITA')}
                className={`px-2 py-2 text-xs font-bold rounded-lg border transition-colors ${
                  selectionTarget === 'LIVE_GRATUITA'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Live Gratuita
              </button>
              <button
                onClick={() => setSelectionTarget('DESPERTOS')}
                className={`px-2 py-2 text-xs font-bold rounded-lg border transition-colors ${
                  selectionTarget === 'DESPERTOS'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                Despertos
              </button>
            </div>
            <button
              onClick={sendSelectedToTelegram}
              disabled={isSendingToTelegram}
              className="w-full px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-70 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              title={`Enviar ${selectedCount} pergunta(s) para ${getSelectionTargetLabel(selectionTarget)} no Telegram`}
            >
              {isSendingToTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar para Telegram
            </button>
          </div>
        )}

        <button
          onClick={() => setShowSelectedOnly((prev) => !prev)}
          disabled={!showSelectedOnly && selectedCount === 0}
          className={`px-5 py-3 rounded-full shadow-lg border text-sm font-bold transition-all flex items-center gap-2 ${
            showSelectedOnly
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
          } ${!showSelectedOnly && selectedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={showSelectedOnly ? 'Mostrar todos novamente' : 'Filtrar apenas os selecionados'}
        >
          <Filter className="w-4 h-4" />
          <span>Selecionados ({selectedCount})</span>
        </button>
      </div>
    </div>
  );
};
