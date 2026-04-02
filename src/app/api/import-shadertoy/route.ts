import { NextRequest, NextResponse } from 'next/server';
import { extractShadertoyId, parsePage, adaptToProject } from '@/lib/shadertoy-importer';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let shaderId: string;
  try {
    shaderId = extractShadertoyId(url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(`https://www.shadertoy.com/view/${shaderId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.shadertoy.com/',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Shadertoy returned ${res.status}. The shader may not exist.` },
        { status: 502 }
      );
    }

    html = await res.text();
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      return NextResponse.json({ error: 'Request to Shadertoy timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch shader page' }, { status: 502 });
  }

  try {
    const raw = parsePage(html);
    const result = adaptToProject(raw);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
