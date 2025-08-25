export interface AgentSearchResult {
    url: string;
    title?: string;
    content?: string;
    score?: number;
    raw_content?: string;
}

export interface AgentResults {
    results: AgentSearchResult[];
}

export interface AgentMonitoringState {
    domain: string | null;
    keyword: string | null;
    region?: string | null;
    searchResults: AgentResults | null;
    ourPosition: number | undefined;
    analysis: string | undefined;
    error: string | undefined;
}
