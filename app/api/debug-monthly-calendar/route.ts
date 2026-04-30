import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'monthly-calendar.json');
    const raw = await fs.readFile(filePath, 'utf-8');

    let parsed: unknown = null;
    let parseError = '';

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      parseError = error instanceof Error ? error.message : 'JSON parse error';
    }

    return NextResponse.json({
      success: true,
      filePath,
      raw,
      parsed,
      parseError,
    });
  } catch (error) {
    console.error('debug-monthly-calendar error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'monthly-calendar.json을 읽는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}