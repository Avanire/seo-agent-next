import type { StateGraphArgs } from '@langchain/langgraph';
import type { AgentMonitoringState, AgentResults } from '@/shared/types';

// Определение состояния согласно документации LangGraphJS
export const STATE_DEFINITION: StateGraphArgs<AgentMonitoringState>['channels'] = {
    domain: {
        value: (prev: string | null, next: string | null) => next ?? prev,
        default: () => null,
    },
    keyword: {
        value: (prev: string | null, next: string | null) => next ?? prev,
        default: () => null,
    },
    region: {
        value: (prev?: string | null, next?: string | null) => next ?? prev,
        default: () => null,
    },
    searchResults: {
        value: (prev: AgentResults | null, next: AgentResults | null) => next ?? prev,
        default: () => null,
    },
    ourPosition: {
        value: (prev: number | undefined, next: number | undefined) => next ?? prev,
        default: () => undefined,
    },
    analysis: {
        value: (prev: string | undefined, next: string | undefined) => next ?? prev,
        default: () => undefined,
    },
    error: {
        value: (prev: string | undefined, next: string | undefined) => next ?? prev,
        default: () => undefined,
    },
};
