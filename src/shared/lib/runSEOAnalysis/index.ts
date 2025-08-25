import { agent } from '@/shared/core/agent';
import type { AgentMonitoringState } from '@/shared/types';

type InputType = Pick<AgentMonitoringState, 'keyword' | 'domain' | 'region'>;

// Экспортируем agent для прямого вызова (опционально)
export async function runSEOAnalysis(options: InputType) {
    return await agent.invoke(options);
}
