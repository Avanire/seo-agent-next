'use client';

import { type FormEvent, useState } from 'react';
import cn from 'classnames';

interface SEOAnalysisFormProps {
    onAnalysisComplete: (data: any) => void;
    onError: (error: string) => void;
}

const mainBgColor = cn('bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600');

export default function SEOAnalysisForm({ onAnalysisComplete, onError }: SEOAnalysisFormProps) {
    const [keyword, setKeyword] = useState('');
    const [domain, setDomain] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ keyword, domain }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            onAnalysisComplete(data);
        } catch (error) {
            onError(error instanceof Error ? error.message : 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="keyword" className="block text-sm font-medium">
                    Ключевое слово:
                </label>
                <input
                    type="text"
                    id="keyword"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Введите ключевое слово"
                />
            </div>

            <div>
                <label htmlFor="domain" className="block text-sm font-medium">
                    Домен сайта:
                </label>
                <input
                    type="text"
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="example.com"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className={cn(mainBgColor, 'px-4 py-2 bg-blue-500 text-white rounded-md disabled:opacity-50')}
            >
                {loading ? 'Анализируем...' : 'Запустить анализ'}
            </button>
        </form>
    );
}
