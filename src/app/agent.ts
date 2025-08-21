import {END, START, StateGraph} from '@langchain/langgraph'
import {TavilySearch} from '@langchain/tavily'
import {GigaChat} from 'langchain-gigachat'
import {Keyword} from '@prisma/client'
import {Agent} from 'node:https'

const config = {
    OUR_DOMAIN: process.env.OUR_DOMAIN || 'localhost',
}

// TODO: Переписать интерфейс для searchResults и keyword?
interface MonitoringState {
    keyword: Keyword | null
    searchResults: any[]
    ourPosition: number | undefined
    analysis: string | undefined
    error: string | undefined
}

const tavily = new TavilySearch({
    tavilyApiKey: process.env.TAVILY_API_KEY,
    includeRawContent: true,
    maxResults: 20,
})

const httpsAgent = new Agent({
    rejectUnauthorized: false,
})

const gigachat = new GigaChat({
    credentials: process.env.GIGACHAT_ACCESS_TOKEN,
    model: 'GigaChat-2',
    httpsAgent,
    temperature: 0.3,
})

// Функция для поиска нашего сайта
const findOurPosition = (results: any[], ourDomain: string): number => {
    for (let i = 0; i < results.length; i++) {
        const url = results[i].url
        if (url.includes(ourDomain)) {
            return i + 1
        }
    }
    return -1
}

// определение состояния согласно документации LangGraphJS
const stateDefinition = {
    keyword: {
        value: (prev: Keyword | null, next: Keyword | null) => next ?? prev,
        default: () => null,
    },
    searchResults: {
        value: (prev: any[], next: any[]) => next ?? prev,
        default: () => [],
    },
    ourPosition: {
        value: (prev: number | undefined, next: number | undefined) =>
            next ?? prev,
        default: () => undefined,
    },
    analysis: {
        value: (prev: string | undefined, next: string | undefined) =>
            next ?? prev,
        default: () => undefined,
    },
    error: {
        value: (prev: string | undefined, next: string | undefined) =>
            next ?? prev,
        default: () => undefined,
    },
}

// Создаем граф workflow с правильной типизацией
const workflow = new StateGraph<typeof stateDefinition>({
    channels: stateDefinition,
})
    .addNode('search', async (state: MonitoringState) => {
        try {
            const results = await tavily.invoke({
                query: state.keyword!.value, // Используем non-null assertion
                search_depth: 'advanced',
                include_domains: ['yandex.ru'],
            })
            return {searchResults: results}
        } catch (error) {
            return {
                error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
        }
    })
    .addNode('analyze_position', async (state: MonitoringState) => {
        const searchResults = state.searchResults!.results
        if (state.error) return {error: state.error}
        if (!searchResults || searchResults.length === 0) {
            return {error: 'No search results'}
        }

        try {
            const ourPosition = findOurPosition(
                searchResults,
                config.OUR_DOMAIN
            )
            return {ourPosition}
        } catch (error) {
            return {
                error: `Position analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
        }
    })
    .addNode('generate_recommendations', async (state: MonitoringState) => {
        if (state.error) return {error: state.error}
        if (state.ourPosition === undefined)
            return {error: 'Position not calculated'}
        if (!state.searchResults || state.searchResults.length === 0) {
            return {error: 'No search results'}
        }

        try {
            const positionText =
                state.ourPosition > 0
                    ? `на позиции ${state.ourPosition}`
                    : 'не в топ-20'

            const prompt = `
        Ты SEO-специалист. Проанализируй позицию сайта ${config.OUR_DOMAIN} 
        по ключевому слову: "${state.keyword!.value}".
        
        Текущая позиция: ${positionText}
        Топ-5 результатов:
        ${state.searchResults!.results
                .slice(0, 5)
                .map((r, i) => `${i + 1}. ${r.title} (${r.url})`)
                .join('\n')}
        
        Дай рекомендации по улучшению позиций. Будь конкретен и предложи практические шаги.
        Оцени срочность и важность рекомендаций.
      `

            const response = await gigachat.invoke(prompt)
            return {analysis: response.text.toString()}
        } catch (error) {
            let errorMessage = 'Unknown error'

            if (error instanceof Error) {
                errorMessage = error.message
            } else if (typeof error === 'object' && error !== null) {
                errorMessage = JSON.stringify(error, null, 2)
            }

            return {
                error: `GigaChat failed: ${errorMessage}`
            }
        }
    })
    .addNode('save_results', async (state: MonitoringState) => {
        if (state.error) {
            console.error(`[${state.keyword!.value}] Error: ${state.error}`)
            return {}
        }

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
        //
        // await prisma.searchResult.create({
        //     data: {
        //         keywordId: state.keyword!.id,
        //         date: new Date(),
        //         positions: JSON.parse(JSON.stringify(positions)),
        //         ourPosition: state.ourPosition || -1,
        //         analysis: state.analysis || '',
        //     },
        // })
        //
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
    .addEdge('save_results', END)

// Компилируем workflow
const app = workflow.compile()

// Запускаем агента
const finalState = await app.invoke({keyword: {value: 'Кухни'}});
console.log('>>>>>', finalState);