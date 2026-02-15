import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Question, QuestionStatus } from '../types';
import { Sparkles, MessageCircle, Clock, CheckCircle2, User, ChevronRight, Star, X, Mail } from 'lucide-react';
import { CHECKOUT_URL } from '../constants';
import { supabase } from '../supabaseClient';

interface QuestionCardProps {
  question: Question;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question }) => {
  const { id, author, text, status, answer, videoUrl } = question;
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isPremiumAccessModalOpen, setIsPremiumAccessModalOpen] = useState(false);
  const [premiumEmail, setPremiumEmail] = useState('');
  const [isCheckingPremiumAccess, setIsCheckingPremiumAccess] = useState(false);
  const [premiumAccessError, setPremiumAccessError] = useState('');

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const videoId = videoUrl ? getYoutubeId(videoUrl) : null;
  const videoThumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  const getStyles = () => {
    switch (status) {
      case QuestionStatus.ANSWERED:
        return {
          card: 'bg-white border-l-4 border-violet-600 shadow-sm ring-1 ring-black/5',
          headerIcon: <CheckCircle2 className="w-3.5 h-3.5 text-violet-700" />,
          statusText: 'Respondido',
          statusBadge: 'bg-violet-100 text-violet-900 border border-violet-200',
          textColor: 'text-slate-900',
          answerContainer: 'mt-3 bg-violet-50/80 p-4 rounded-xl border border-violet-100/50',
          cursor: 'cursor-default',
          iconColor: 'text-violet-600',
        };
      case QuestionStatus.PREMIUM:
        return {
          card: 'bg-amber-50/40 border-l-4 border-amber-400 shadow-md ring-1 ring-amber-100/50 relative overflow-hidden',
          headerIcon: <Sparkles className="w-3.5 h-3.5 text-amber-700" />,
          statusText: 'Despertos da Era de Aquário',
          statusBadge: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border border-amber-200 font-bold',
          textColor: 'text-slate-900',
          answerContainer: 'mt-3 bg-white/80 p-4 rounded-xl border border-amber-100',
          cursor: 'cursor-default',
          iconColor: 'text-amber-600',
        };
      case QuestionStatus.PENDING:
      default:
        return {
          card: 'bg-white border-l-4 border-slate-300 shadow-sm opacity-90',
          headerIcon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
          statusText: 'Aguardando',
          statusBadge: 'bg-slate-100 text-slate-600 border border-slate-200',
          textColor: 'text-slate-600',
          answerContainer: '',
          cursor: 'cursor-default',
          iconColor: 'text-slate-500',
        };
    }
  };

  const styles = getStyles();

  const requestPremiumAccess = async () => {
    const email = premiumEmail.trim().toLowerCase();
    if (!email) {
      setPremiumAccessError('Informe seu e-mail para validar o acesso.');
      return;
    }

    setIsCheckingPremiumAccess(true);
    setPremiumAccessError('');

    try {
      const { data, error } = await supabase.functions.invoke('send-selected-questions-telegram', {
        body: {
          action: 'CHECK_PREMIUM_ACCESS',
          email,
        },
      });

      if (error) {
        throw new Error(error.message || 'Falha ao validar acesso.');
      }

      if (data?.allowed) {
        setIsPremiumAccessModalOpen(false);
        if (videoId) {
          setIsVideoModalOpen(true);
        } else {
          setPremiumAccessError('Video ainda nao disponivel para este conteudo.');
        }
        return;
      }

      window.location.href = CHECKOUT_URL;
    } catch (err) {
      console.error(err);
      setPremiumAccessError('Nao foi possivel validar agora. Tente novamente.');
    } finally {
      setIsCheckingPremiumAccess(false);
    }
  };

  return (
    <div
      className={`w-full rounded-2xl p-5 mb-4 ${styles.card} ${styles.cursor} animate-fade-in-up`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '320px' }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 p-2 rounded-full border border-slate-100 shadow-sm">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">#{id}</span>
            <span className="text-sm font-semibold text-slate-800 leading-none">{author || 'Anônimo'}</span>
          </div>
        </div>

        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm max-w-[170px] whitespace-nowrap overflow-hidden text-ellipsis ${styles.statusBadge}`}>
          {styles.headerIcon}
          <span className="truncate">{styles.statusText}</span>
        </span>
      </div>

      <div className="mb-2 pl-1">
        <h3 className={`text-lg font-bold leading-snug ${styles.textColor}`}>{text}</h3>
      </div>

      {status === QuestionStatus.ANSWERED && (
        <div className={styles.answerContainer}>
          <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide ${styles.iconColor}`}>
            <MessageCircle className="w-4 h-4" />
            Resposta do Luciano
          </div>

          {videoId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVideoModalOpen(true);
              }}
              className="mb-4 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"
            >
              Ver resposta em video
            </button>
          )}

          <p className="text-base leading-relaxed text-slate-800 whitespace-pre-line">{answer}</p>
        </div>
      )}

      {status === QuestionStatus.PREMIUM && (
        <div className="relative mt-4">
          <div className={styles.answerContainer}>
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span className="text-sm font-bold text-amber-700">Resposta exclusiva para assinantes</span>
            </div>

            {videoId ? (
              <div className="relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black shadow-md ring-1 ring-black/10 mb-3">
                <img
                  src={videoThumbnailUrl || ''}
                  alt="Preview do vídeo exclusivo"
                  loading="lazy"
                  decoding="async"
                  className="absolute top-0 left-0 w-full h-full object-cover blur-sm scale-105 opacity-90"
                />
                <div className="absolute inset-0 bg-black/35" />
              </div>
            ) : (
              <p className="text-sm text-slate-700 mb-3">A resposta em video sera publicada em breve.</p>
            )}

            <button
              onClick={() => {
                setPremiumAccessError('');
                setIsPremiumAccessModalOpen(true);
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-5 py-2.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm font-bold transition-all border border-white/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Desbloquear Resposta</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {status === QuestionStatus.PENDING && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Aguardando análise da equipe.
        </div>
      )}

      {typeof document !== 'undefined' && isVideoModalOpen && videoId &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/75 p-3 sm:p-6 overflow-y-auto" onClick={() => setIsVideoModalOpen(false)}>
            <div className="min-h-full flex items-start sm:items-center justify-center">
              <div className="relative w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setIsVideoModalOpen(false)}
                  className="absolute top-2 right-2 z-10 bg-black/70 hover:bg-black text-white p-2 rounded-full"
                  aria-label="Fechar video"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="Resposta em video"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {typeof document !== 'undefined' && isPremiumAccessModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 p-4 overflow-y-auto" onClick={() => setIsPremiumAccessModalOpen(false)}>
            <div className="min-h-full flex items-center justify-center">
              <div className="w-full max-w-md bg-white rounded-xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-slate-900">Validar acesso Despertos</h4>
                  <button onClick={() => setIsPremiumAccessModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-slate-600 mb-3">Digite seu e-mail de assinatura para liberar este video.</p>

                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 mb-3">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={premiumEmail}
                    onChange={(e) => setPremiumEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full outline-none text-slate-900"
                  />
                </div>

                {premiumAccessError && <p className="text-xs text-red-600 mb-3">{premiumAccessError}</p>}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setIsPremiumAccessModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-bold text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={requestPremiumAccess}
                    disabled={isCheckingPremiumAccess}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white font-bold text-sm"
                  >
                    {isCheckingPremiumAccess ? 'Validando...' : 'Liberar acesso'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
