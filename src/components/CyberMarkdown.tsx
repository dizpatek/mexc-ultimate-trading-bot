import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface CyberMarkdownProps {
    content: string;
    className?: string;
}

export const CyberMarkdown: React.FC<CyberMarkdownProps> = ({ content, className }) => {
    return (
        <div className={cn(
            "prose prose-invert max-w-none",
            "prose-h1:text-4xl prose-h1:font-black prose-h1:italic prose-h1:tracking-tighter prose-h1:text-transparent prose-h1:bg-clip-text prose-h1:bg-gradient-to-r prose-h1:from-cyan-400 prose-h1:to-blue-600 prose-h1:mb-8",
            "prose-h2:text-lg prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-cyan-500/80 prose-h2:border-b prose-h2:border-cyan-500/20 prose-h2:pb-1 prose-h2:mt-6",
            "prose-h3:text-md prose-h3:font-bold prose-h3:text-indigo-400 prose-h3:mt-4",
            "prose-p:text-slate-300 prose-p:leading-relaxed prose-p:my-2",
            "prose-strong:text-cyan-400 prose-strong:font-bold",
            "prose-blockquote:border-l-2 prose-blockquote:border-cyan-500 prose-blockquote:bg-cyan-500/5 prose-blockquote:p-4 prose-blockquote:my-4 prose-blockquote:rounded-r-lg prose-blockquote:italic",
            "prose-table:border prose-table:border-slate-800 prose-table:rounded-xl prose-table:overflow-hidden",
            "prose-th:bg-slate-900/80 prose-th:p-4 prose-th:text-cyan-400 prose-th:uppercase prose-th:text-[10px] prose-th:font-black",
            "prose-td:p-4 prose-td:border-t prose-td:border-slate-800/50 prose-td:text-xs",
            "prose-code:text-cyan-300 prose-code:bg-slate-900/80 prose-code:px-2 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-cyan-500/20",
            "prose-pre:bg-[#020617] prose-pre:border prose-pre:border-slate-800 prose-pre:shadow-2xl prose-pre:rounded-2xl prose-pre:p-6",
            "prose-ul:list-disc prose-ul:pl-6",
            "prose-li:text-slate-400 prose-li:my-1",
            className
        )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
        </div>
    );
};
