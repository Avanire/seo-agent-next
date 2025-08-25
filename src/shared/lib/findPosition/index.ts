import type { AgentMonitoringState, AgentSearchResult } from '@/shared/types';

// Поиск позиции домена среди результатов
export const findDomainPosition = (results: AgentSearchResult[], domain: AgentMonitoringState['domain']): number => {
    for (let i = 0; i < results.length; i++) {
        const url = results[i].url;
        if (domain && url.includes(domain)) {
            return i + 1;
        }
    }
    return -1;
};
