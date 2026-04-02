import { NextRequest, NextResponse } from 'next/server';
import { extractShadertoyId, adaptToProject } from '@/lib/shadertoy-importer';
import type { ShadertoyRawData } from '@/lib/shadertoy-importer';

/**
 * GET /api/import-shadertoy?url=...&key=...
 *
 * Uses the official Shadertoy API (requires user's API key).
 * API keys are free for Silver/Gold accounts: shadertoy.com/myapps
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const key = request.nextUrl.searchParams.get('key');

  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  if (!key) return NextResponse.json({ error: 'missing_key' }, { status: 400 });

  let shaderId: string;
  try {
    shaderId = extractShadertoyId(url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  let raw: ShadertoyRawData;
  try {
    const apiUrl = `https://www.shadertoy.com/api/v1/shaders/${shaderId}?key=${encodeURIComponent(key)}`;
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Shadertoy API returned ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json() as { Error?: string; Shader?: ShadertoyRawData };

    if (json.Error) {
      // Common API errors: "Invalid key", "Shader not found", "Shader is private"
      if (json.Error.toLowerCase().includes('key')) {
        return NextResponse.json({ error: 'invalid_key' }, { status: 401 });
      }
      return NextResponse.json({ error: json.Error }, { status: 422 });
    }

    if (!json.Shader) {
      return NextResponse.json({ error: 'No shader data in API response' }, { status: 422 });
    }

    raw = json.Shader;
  } catch (e) {
    if ((e as Error).name === 'TimeoutError') {
      return NextResponse.json({ error: 'Request to Shadertoy timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to reach Shadertoy API' }, { status: 502 });
  }

  try {
    const result = adaptToProject(raw);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
