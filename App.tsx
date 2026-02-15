import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Question, QuestionStatus } from './types';
import { QuestionCard } from './components/QuestionCard';
import { QuestionForm } from './components/QuestionForm';
import { AdminLogin } from './components/AdminLogin';
import { AdminPanel } from './components/AdminPanel';
import { Filter, ArrowUpDown, CheckCircle2, Sparkles, Clock, Layers, Loader2, Stars } from 'lucide-react';

type SortOption = 'NEWEST' | 'OLDEST';
type FilterOption = 'ALL' | QuestionStatus;

export default function App() {
  // Routing State
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // App State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState<FilterOption>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOption>('NEWEST');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check URL hash for simple routing
  useEffect(() => {
    const handleHashChange = () => {
      setIsAdminRoute(window.location.hash === '#admin');
    };

    // Check on mount
    handleHashChange();

    // Listen for changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch data from Supabase
  useEffect(() => {
    if (!isAdminRoute) {
      fetchQuestions();
    }
  }, [isAdminRoute]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar perguntas:', error);
        return;
      }

      if (data) {
        const mappedQuestions: Question[] = data.map((item: any) => ({
          id: item.id,
          author: item.author,
          text: item.text,
          status: item.status as QuestionStatus,
          answer: item.answer,
          videoUrl: item.video_url,
          timestamp: new Date(item.created_at)
        }));
        setQuestions(mappedQuestions);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const nextId = useMemo(() => {
    if (questions.length === 0) return 1894; 
    return Math.max(...questions.map(q => q.id)) + 1;
  }, [questions]);

  const handleNewQuestion = async (author: string, text: string) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .insert([
          { 
            author: author.trim() || "Anônimo", 
            text: text.trim(), 
            status: QuestionStatus.PENDING 
          }
        ])
        .select();

      if (error) {
        alert('Erro ao enviar pergunta. Tente novamente.');
        console.error(error);
      } else if (data) {
        fetchQuestions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const processedQuestions = useMemo(() => {
    let result = [...questions];

    if (statusFilter !== 'ALL') {
      result = result.filter(q => q.status === statusFilter);
    }

    result.sort((a, b) => {
      if (sortOrder === 'NEWEST') {
        return b.timestamp.getTime() - a.timestamp.getTime();
      }
      if (sortOrder === 'OLDEST') {
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
      return 0;
    });

    return result;
  }, [questions, statusFilter, sortOrder]);

  // --- ADMIN ROUTING ---
  if (isAdminRoute) {
    if (!isAdminAuthenticated) {
      return <AdminLogin onLogin={() => setIsAdminAuthenticated(true)} />;
    }
    return <AdminPanel />;
  }

  // --- USER APP ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Hero Header - Era de Aquário Theme Enhanced */}
      <header className="relative bg-[#1a0b2e] pb-24 pt-12 rounded-b-[3rem] shadow-2xl overflow-hidden z-10">
        
        {/* Animated Background Layers */}
        <div className="absolute inset-0 w-full h-full">
           {/* Deep Space Base */}
           <div className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-indigo-900 opacity-90"></div>
           
           {/* Pattern Overlay */}
           <div className="absolute inset-0 bg-grid-white opacity-10"></div>

           {/* Animated Blobs (Nebula Effect) */}
           <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
           <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
           <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
           
           {/* Stars/Dust particles (Static for performance, but look active) */}
           <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
        </div>

        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            
            <div className="flex flex-col gap-3">
              {/* Ethereal Title */}
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg blur opacity-25"></div>
                <h1 className="relative text-4xl sm:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-lg">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-200 via-indigo-100 to-amber-100 animate-pulse">
                    Luciano Space
                  </span>
                </h1>
              </div>

              <p className="text-indigo-200/90 text-sm font-medium max-w-md leading-relaxed flex items-center gap-2">
                 <Stars className="w-4 h-4 text-amber-300" />
                 O Portal da Era de Aquário
              </p>
            </div>
            
            {/* Glassmorphism Counter Badge */}
            <div className="w-full sm:w-auto mt-4 sm:mt-0">
               <div className="bg-white/5 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-lg relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative flex items-center justify-between sm:block gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Dúvidas
                      </span>
                      <p className="text-3xl font-black text-white drop-shadow-md">
                        {isLoading ? '...' : questions.length}
                      </p>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area - Overlaps Header */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 -mt-12 relative z-20 pb-48"> 
        
        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xl shadow-indigo-900/10 mb-6">
          <div className="flex flex-col gap-4">
            
            {/* Top Row: Title + Sort */}
            <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                 <Filter className="w-4 h-4 text-indigo-600" />
                 Filtrar Dúvidas
               </h2>
               
               {/* Sort Dropdown */}
               <div className="relative group">
                 <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOption)}
                    className="appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all hover:bg-slate-100"
                    aria-label="Ordenar perguntas"
                  >
                    <option value="NEWEST">Mais recentes</option>
                    <option value="OLDEST">Mais antigas</option>
                  </select>
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none group-hover:text-indigo-500 transition-colors" />
               </div>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`flex-1 min-w-[80px] px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                  statusFilter === 'ALL' 
                    ? 'bg-slate-800 border-slate-800 text-white shadow-md shadow-slate-200' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                Todas
              </button>
              <button
                onClick={() => setStatusFilter(QuestionStatus.ANSWERED)}
                className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                  statusFilter === QuestionStatus.ANSWERED
                    ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200' 
                    : 'bg-white border-slate-200 text-violet-600 hover:border-violet-200 hover:bg-violet-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Respondidas
              </button>
              <button
                onClick={() => setStatusFilter(QuestionStatus.PREMIUM)}
                className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                  statusFilter === QuestionStatus.PREMIUM
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200' 
                    : 'bg-white border-slate-200 text-amber-600 hover:border-amber-200 hover:bg-amber-50'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Despertos
              </button>
              <button
                onClick={() => setStatusFilter(QuestionStatus.PENDING)}
                className={`flex-1 min-w-[90px] px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                  statusFilter === QuestionStatus.PENDING
                    ? 'bg-slate-500 border-slate-500 text-white shadow-md shadow-slate-200' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Clock className="w-4 h-4" />
                Pendentes
              </button>
            </div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Carregando perguntas...</p>
          </div>
        ) : processedQuestions.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center">
            <div className="bg-slate-100 p-6 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">Tudo calmo por aqui</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-[200px]">Seja o primeiro a enviar uma dúvida para a comunidade.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {processedQuestions.map((question) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        )}
      </main>

      {/* Sticky Footer Form */}
      <QuestionForm 
        nextId={nextId} 
        onSubmit={handleNewQuestion}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
