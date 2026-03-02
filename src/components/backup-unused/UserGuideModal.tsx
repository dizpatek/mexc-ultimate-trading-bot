import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen } from 'lucide-react';

interface UserGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose, content }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Kullanıcı Kılavuzu</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-slate-950/50">
                    <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-800 prose-h2:pb-2 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-code:text-amber-300 prose-code:bg-slate-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-table:border-collapse prose-th:bg-slate-900 prose-th:p-3 prose-th:text-left prose-td:p-3 prose-td:border-b prose-td:border-slate-800 prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-500/10 prose-blockquote:p-4 prose-blockquote:rounded-r-lg prose-a:text-blue-400 hover:prose-a:text-blue-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
                    >
                        Kapat
                    </button>
                </div>
            </div>
        </div>
    );
};
