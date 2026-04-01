import { NextRequest, NextResponse } from 'next/server';

/**
 * Export metadata endpoint.
 * The actual export (PNG/WebM/GIF) is done client-side via canvas APIs.
 * This endpoint handles upload of thumbnails and export job tracking.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shaderId, format, preset, duration } = body;

    if (!shaderId) {
      return NextResponse.json({ error: 'shaderId required' }, { status: 400 });
    }

    // In a full implementation, you'd:
    // 1. Create an export job record in DB
    // 2. Queue a background render (e.g. Puppeteer headless)
    // 3. Return job ID for polling

    const jobId = `export_${shaderId}_${Date.now()}`;

    return NextResponse.json({
      data: {
        jobId,
        status: 'client-side',
        message: 'Export is handled client-side via canvas APIs',
        shaderId,
        format,
        preset,
        duration,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
