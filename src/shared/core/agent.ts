import { END, START, StateGraph } from '@langchain/langgraph';
import { TavilySearch } from '@langchain/tavily';
import { GigaChat } from 'langchain-gigachat';
import { Agent } from 'node:https';
import type { AgentMonitoringState } from '@/shared/types';
import { findDomainPosition } from '@/shared/lib/findPosition';
import { STATE_DEFINITION } from '@/shared/core/config';
import { getTopResults } from '@/shared/lib/getTopResults';

const tavily = new TavilySearch({
    tavilyApiKey: process.env.TAVILY_API_KEY,
    includeRawContent: true,
    maxResults: 20,
});

const httpsAgent = new Agent({
    rejectUnauthorized: false,
});

const gigachat = new GigaChat({
    credentials: process.env.GIGACHAT_ACCESS_TOKEN,
    model: 'GigaChat-2',
    httpsAgent,
    temperature: 0.3,
});

// Создаем граф workflow с правильной типизацией
const workflow = new StateGraph({
    channels: STATE_DEFINITION,
})
    .addNode('search', async ({ keyword }: AgentMonitoringState) => {
        try {
            if (!keyword) {
                return { error: 'Keyword is required' };
            }
            const results = await tavily.invoke({
                query: keyword,
                search_depth: 'advanced',
                include_domains: ['yandex.ru'],
            });
            return { searchResults: results };
        } catch (error) {
            return {
                error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    })
    .addNode('analyze_position', async ({ searchResults, domain, error }: AgentMonitoringState) => {
        const findResults = searchResults?.results;

        if (error) return { error };
        if (!findResults || findResults.length === 0) {
            return { error: 'No search results' };
        }

        try {
            if (!domain) {
                return { error: 'domain is required' };
            }
            const ourPosition = findDomainPosition(findResults, domain);
            return { ourPosition };
        } catch (error) {
            return {
                error: `Position analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    })
    .addNode(
        'generate_recommendations',
        async ({ searchResults, domain, error, ourPosition, keyword }: AgentMonitoringState) => {
            const findResults = searchResults?.results;

            if (error) return { error };
            if (ourPosition === undefined) return { error: 'Position not calculated' };
            if (!findResults || findResults.length === 0) {
                return { error: 'No search results' };
            }

            try {
                const positionText = ourPosition > 0 ? `на позиции ${ourPosition}` : 'не в топ-20';

                const prompt = `
        Ты SEO-специалист. Проанализируй позицию сайта ${domain} 
        по ключевому слову: "${keyword}".
        
        Текущая позиция: ${positionText}
        Топ-5 результатов:
        ${getTopResults(findResults)}
        
        Дай рекомендации по улучшению позиций. Будь конкретен и предложи практические шаги.
        Оцени срочность и важность рекомендаций.
      `;

                const response = await gigachat.invoke(prompt);
                return { analysis: response.text.toString() };
            } catch (error) {
                return {
                    error: `GigaChat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                };
            }
        }
    )
    .addNode('save_results', async (state: AgentMonitoringState) => {
        // TODO: реализовать сохранение результатов
        // if (state.error) {
        //     console.error(`[${state.keyword}] Error: ${state.error}`)
        //     return {}
        // }
        // try {
        //     const positions: Position[] = state.searchResults.map(
        //         (result, index) => ({
        //             url: result.url,
        //             title: result.title,
        //             position: index + 1,
        //             isOurSite: config.OUR_DOMAINS.some((domain) =>
        //                 result.url.includes(domain)
        //             ),
        //         })
        //     )
        // await prisma.searchResult.create({
        //     data: {
        //         keywordId: state.keyword!.id,
        //         date: new Date(),
        //         positions: JSON.parse(JSON.stringify(positions)),
        //         ourPosition: state.ourPosition || -1,
        //         analysis: state.analysis || '',
        //     },
        // })
        //     return {}
        // } catch (error) {
        //     return {
        //         error: `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        //     }
        // }
    })
    .addEdge(START, 'search')
    .addEdge('search', 'analyze_position')
    .addEdge('analyze_position', 'generate_recommendations')
    .addEdge('generate_recommendations', 'save_results')
    .addEdge('save_results', END);

// Экспорт agent для использования в API route
export const agent = workflow.compile();
