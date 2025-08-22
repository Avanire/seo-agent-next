'use client';

import { useState } from 'react';
import cn from 'classnames';

import type { MonitoringState } from '../../../../app/agent';
import SEOAnalysisForm from './SEOAnalysisForm';

const mainBgColor = cn('bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600');

export default function Home() {
    const [results, setResults] = useState<MonitoringState | null>(null);
    const [error, setError] = useState<string>('');

    const handleAnalysisComplete = (data: MonitoringState) => {
        setResults(data);
        setError('');
    };

    const handleError = (errorMessage: string) => {
        setError(errorMessage);
        setResults(null);
    };

    return (
        <div className="container p-4 min-w-[100vw]">
            <div className={cn(mainBgColor, 'text-white py-12 px-4 sm:px-6 lg:px-8 mb-8')}>
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                        SEO Analyzer для Yandex
                    </h1>
                    <p className="mt-6 text-xl text-indigo-100 max-w-3xl mx-auto">
                        AI-анализ вашего сайта и рекомендации по продвижению в поисковой выдаче
                    </p>
                </div>
            </div>

            <SEOAnalysisForm onAnalysisComplete={handleAnalysisComplete} onError={handleError} />

            {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">Ошибка: {error}</div>
            )}

            {results && (
                <div className="mt-6">
                    <h2 className="text-xl font-semibold mb-3">Результаты анализа</h2>

                    <div className="grid gap-4">
                        <div className="p-4 bg-gray-50 rounded">
                            <strong>Ключевое слово:</strong> {results.keyword}
                        </div>

                        <div className="p-4 bg-gray-50 rounded">
                            <strong>Домен:</strong> {results.domain}
                        </div>

                        <div className="p-4 bg-gray-50 rounded">
                            <strong>Позиция:</strong> {results.ourPosition || 'Не найдена'}
                        </div>

                        {results.analysis && (
                            <div className="p-4 bg-white border rounded">
                                <strong>Рекомендации:</strong>
                                <p className="mt-2 whitespace-pre-wrap">{results.analysis}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
