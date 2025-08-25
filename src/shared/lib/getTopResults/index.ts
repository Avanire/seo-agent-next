import type { AgentSearchResult } from '@/shared/types';

// Поиск топ результатов в границах значения и его вывод в строку
export const getTopResults = (results: AgentSearchResult[], topValueLimit?: number): string =>
    results
        .slice(0, topValueLimit ?? 5)
        .map((r, i) => `${i + 1}. ${r.title} (${r.url})`)
        .join('\n');
