import React from 'react';
import { Question, QuestionStatus } from '../types';
import { Sparkles, MessageCircle, Clock, CheckCircle2, User, ChevronRight, Star } from 'lucide-react';
import { CHECKOUT_URL } from '../constants';

interface QuestionCardProps {
  question: Question;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question }) => {
  const { id, author, text, status, answer, videoUrl } = question;

  // Helper to extract YouTube ID
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const videoId = videoUrl ? getYoutubeId(videoUrl) : null;

  // Handler for Premium click (Card level)
  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking on YouTube iframe area (handled by iframe itself) or controls
    if ((e.target as HTMLElement).closest('iframe')) return;

    if (status === QuestionStatus.PREMIUM) {
      window.location.href = CHECKOUT_URL;
    }
  };

  // Styles configuration based on status
  const getStyles = () => {
    switch (status) {
      case QuestionStatus.ANSWERED:
        return {
          // Violet Card (Era de Aquário Theme)
          card: "bg-white border-l-4 border-violet-600 shadow-sm ring-1 ring-black/5",
          headerIcon: <CheckCircle2 className="w-3.5 h-3.5 text-violet-700" />,
          statusText: "Respondido",
          statusBadge: "bg-violet-100 text-violet-900 border border-violet-200",
          textColor: "text-slate-900",
          answerContainer: "mt-3 bg-violet-50/80 p-4 rounded-xl border border-violet-100/50",
          cursor: "cursor-default",
          iconColor: "text-violet-600"
        };
      case QuestionStatus.PREMIUM:
        return {
          // Amber/Gold Card (Premium feel)
          card: "bg-amber-50/40 border-l-4 border-amber-400 shadow-md ring-1 ring-amber-100/50 hover:shadow-lg transition-all duration-300 relative overflow-hidden group",
          headerIcon: <Sparkles className="w-3.5 h-3.5 text-amber-700" />,
          statusText: "Despertos da Era de Aquário",
          statusBadge: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border border-amber-200 font-bold",
          textColor: "text-slate-900",
          answerContainer: "mt-3 bg-white/60 p-4 rounded-xl border border-amber-100 blur-[2px] select-none opacity-80",
          cursor: "cursor-pointer transform hover:-translate-y-0.5",
          iconColor: "text-amber-600"
        };
      case QuestionStatus.PENDING:
      default:
        return {
          // Slate Card (Neutral)
          card: "bg-white border-l-4 border-slate-300 shadow-sm opacity-90",
          headerIcon: <Clock className="w-3.5 h-3.5 text-slate-500" />,
          statusText: "Aguardando",
          statusBadge: "bg-slate-100 text-slate-600 border border-slate-200",
          textColor: "text-slate-600",
          answerContainer: "",
          cursor: "cursor-default",
          iconColor: "text-slate-500"
        };
    }
  };

  const styles = getStyles();

  return (
    <div 
      onClick={handleCardClick}
      className={`w-full rounded-2xl p-5 mb-4 ${styles.card} ${styles.cursor} animate-fade-in-up`}
    >
      {/* Header: ID and Author */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 p-2 rounded-full border border-slate-100 shadow-sm">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">
              #{id}
            </span>
            <span className="text-sm font-semibold text-slate-800 leading-none">
              {author || "Anônimo"}
            </span>
          </div>
        </div>
        
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm max-w-[150px] whitespace-nowrap overflow-hidden text-ellipsis ${styles.statusBadge}`}>
          {styles.headerIcon}
          <span className="truncate">{styles.statusText}</span>
        </span>
      </div>

      {/* Question Body */}
      <div className="mb-2 pl-1">
        <h3 className={`text-lg font-bold leading-snug ${styles.textColor}`}>
          {text}
        </h3>
      </div>

      {/* Answer Section */}
      {status === QuestionStatus.ANSWERED && (
        <div className={styles.answerContainer}>
          <div className={`flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wide ${styles.iconColor}`}>
            <MessageCircle className="w-4 h-4" /> 
            Resposta do Luciano
          </div>
          
          {/* Video Player if ID exists */}
          {videoId && (
            <div className="mb-4 relative w-full pt-[56.25%] rounded-xl overflow-hidden bg-black shadow-md ring-1 ring-black/10">
               <iframe 
                src={`https://www.youtube.com/embed/${videoId}`}
                title="YouTube video player" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full border-0"
              />
            </div>
          )}

          <p className="text-base leading-relaxed text-slate-800 whitespace-pre-line">
            {answer}
          </p>
        </div>
      )}

      {/* Premium Teaser */}
      {status === QuestionStatus.PREMIUM && (
        <div className="relative mt-4">
             {/* Blurred Content */}
             <div className={styles.answerContainer}>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Resposta Exclusiva
              </div>
              <p className="text-base leading-relaxed">
                Essa resposta contém orientações profundas e estratégias exclusivas do Despertar da Era de Aquário. Acesse para desbloquear.
              </p>
            </div>
            
            {/* Clear Call to Action Overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <a 
                  href={CHECKOUT_URL}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-6 py-2.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-2 text-sm font-bold transition-all transform active:scale-95 border border-white/20 ring-4 ring-amber-500/20 no-underline"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Desbloquear Resposta</span>
                    <ChevronRight className="w-4 h-4" />
                </a>
            </div>
        </div>
      )}

      {/* Pending Footer */}
      {status === QuestionStatus.PENDING && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Aguardando análise da equipe.
        </div>
      )}
    </div>
  );
};