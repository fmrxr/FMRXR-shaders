import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_PREFIXES = ['/media/', '/presets/'];

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');

  if (!src || !ALLOWED_PREFIXES.some(p => src.startsWith(p))) {
    return NextResponse.json({ error: 'Invalid src parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://www.shadertoy.com${src}`, {
      headers: {
        'Referer': 'https://www.shadertoy.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch asset' }, { status: 502 });
  }
}
