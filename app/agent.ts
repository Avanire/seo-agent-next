import { END, START, StateGraph, StateGraphArgs } from '@langchain/langgraph';
import { TavilySearch } from '@langchain/tavily';
import { GigaChat } from 'langchain-gigachat';
import { Agent } from 'node:https';

interface SearchResult {
    url: string;
    title?: string;
    content?: string;
    score?: number;
    raw_content?: string;
}

interface Results {
    results: SearchResult[];
}

interface MonitoringState {
    domain: string | null;
    keyword: string | null;
    searchResults: Results | null;
    ourPosition: number | undefined;
    analysis: string | undefined;
    error: string | undefined;
}

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

// Функция для поиска нашего сайта
const findOurPosition = (results: SearchResult[], ourDomain: string): number => {
    for (let i = 0; i < results.length; i++) {
        const url = results[i].url;
        if (url.includes(ourDomain)) {
            return i + 1;
        }
    }
    return -1;
};

// определение состояния согласно документации LangGraphJS
const stateDefinition: StateGraphArgs<MonitoringState>['channels'] = {
    domain: {
        value: (prev: string | null, next: string | null) => next ?? prev,
        default: () => null,
    },
    keyword: {
        value: (prev: string | null, next: string | null) => next ?? prev,
        default: () => null,
    },
    searchResults: {
        value: (prev: Results | null, next: Results | null) => next ?? prev,
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

// Создаем граф workflow с правильной типизацией
const workflow = new StateGraph({
    channels: stateDefinition,
})
    .addNode('search', async (state: MonitoringState) => {
        try {
            if (!state.keyword) {
                return { error: 'Keyword is required' };
            }
            const results = await tavily.invoke({
                query: state.keyword,
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
    .addNode('analyze_position', async (state: MonitoringState) => {
        const searchResults = state.searchResults!.results;
        if (state.error) return { error: state.error };
        if (!searchResults || searchResults.length === 0) {
            return { error: 'No search results' };
        }

        try {
            if (!state.domain) {
                return { error: 'domain is required' };
            }
            const ourPosition = findOurPosition(searchResults, state.domain);
            return { ourPosition };
        } catch (error) {
            return {
                error: `Position analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    })
    .addNode('generate_recommendations', async (state: MonitoringState) => {
        const findResults = state.searchResults?.results;
        if (state.error) return { error: state.error };
        if (state.ourPosition === undefined) return { error: 'Position not calculated' };
        if (!findResults || findResults.length === 0) {
            return { error: 'No search results' };
        }

        try {
            const positionText = state.ourPosition > 0 ? `на позиции ${state.ourPosition}` : 'не в топ-20';

            const prompt = `
        Ты SEO-специалист. Проанализируй позицию сайта ${state.domain} 
        по ключевому слову: "${state.keyword}".
        
        Текущая позиция: ${positionText}
        Топ-5 результатов:
        ${findResults
            .slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.title} (${r.url})`)
            .join('\n')}
        
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
    })
    .addNode('save_results', async (state: MonitoringState) => {
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

// Экспортируем app для использования в API route
export const app = workflow.compile();

// Экспортируем тип для клиентской части
export type { MonitoringState };

// Экспортируем функцию для прямого вызова (опционально)
export async function runSEOAnalysis(keyword: string, domain: string) {
    return await app.invoke({ keyword, domain });
}
