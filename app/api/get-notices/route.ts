import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NoticeItem = {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
};

type NormalizedResponse = {
  success: true;
  notices: NoticeItem[];
};

function normalizeNoticeArray(raw: unknown): NoticeItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const obj = (item ?? {}) as Record<string, unknown>;

    return {
      id: String(obj.id ?? `notice-${index + 1}`),
      title: String(obj.title ?? '공지'),
      content: String(
        obj.content ??
          obj.description ??
          obj.body ??
          obj.text ??
          ''
      ),
      createdAt: obj.createdAt ? String(obj.createdAt) : undefined,
    };
  });
}

function pickNoticeListFromUnknown(raw: unknown): NoticeItem[] {
  if (Array.isArray(raw)) {
    return normalizeNoticeArray(raw);
  }

  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const obj = raw as Record<string, unknown>;

  const candidates = [
    obj.notices,
    obj.items,
    obj.data,
    obj.noticeList,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeNoticeArray(candidate);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

async function tryReadJson(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const candidates = [
      path.join(process.cwd(), 'storage', 'notices.json'),
      path.join(process.cwd(), 'storage', 'notice.json'),
    ];

    for (const filePath of candidates) {
      const parsed = await tryReadJson(filePath);
      const notices = pickNoticeListFromUnknown(parsed);

      if (notices.length > 0) {
        const result: NormalizedResponse = {
          success: true,
          notices,
        };
        return NextResponse.json(result);
      }
    }

    return NextResponse.json({
      success: true,
      notices: [],
    });
  } catch (error) {
    console.error('get-notices error:', error);

    return NextResponse.json(
      {
        success: false,
        message: '전체공지를 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}