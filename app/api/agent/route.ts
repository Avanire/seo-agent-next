import { NextResponse } from 'next/server';
import { agent } from '@/shared/core/agent';

export async function POST(request: Request) {
    if (request.method !== 'POST') {
        return NextResponse.json({ error: 'Method not allowed' });
    }

    try {
        const { keyword, domain, region } = await request.json();

        if (!keyword || !domain) {
            return NextResponse.json({ error: 'Keyword and domain are required' }, { status: 400 });
        }

        const analysisResult = await agent.invoke({ keyword, domain, region });

        return NextResponse.json(analysisResult);
    } catch (error) {
        console.error('SEO analysis error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
            },
            { status: 500 }
        );
    }
}
