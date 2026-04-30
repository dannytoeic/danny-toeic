import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';

type ClassUpdateRow = {
  class_key: string;
  global_notice_text: string | null;
  cards: unknown[] | null;
};

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type VideoItem = {
  id?: string;
  role?: 'rc' | 'lc' | 'main' | 'extra';
  url?: string;
};

type AudioItem = {
  id?: string;
  category?: 'class' | 'homework' | 'memorize' | 'extra';
  title?: string;
  url?: string;
};

type ExtraItem = {
  id?: string;
  type?: 'text' | 'image' | 'link';
  text?: string;
  imageUrl?: string;
  linkTitle?: string;
  linkUrl?: string;
};

function inferClassKeyFromText(text: string): ClassKey | '' {
  const value = text.toLowerCase();

  if (value.includes('class-600-monwed') || value.includes('600-monwed')) {
    return '600-monwed';
  }
  if (value.includes('class-600-tuthu') || value.includes('600-tuthu')) {
    return '600-tuthu';
  }
  if (value.includes('class-800-monwed') || value.includes('800-monwed')) {
    return '800-monwed';
  }
  if (value.includes('class-800-tuthu') || value.includes('800-tuthu')) {
    return '800-tuthu';
  }

  return '';
}

function resolveClassKey(request: NextRequest): ClassKey | '' {
  const fromQuery = request.nextUrl.searchParams.get('classKey')?.trim() || '';
  const queryClassKey = inferClassKeyFromText(fromQuery);
  if (queryClassKey) return queryClassKey;

  const referer = request.headers.get('referer') || '';
  const refererClassKey = inferClassKeyFromText(referer);
  if (refererClassKey) return refererClassKey;

  const pathname = request.nextUrl.pathname || '';
  const pathnameClassKey = inferClassKeyFromText(pathname);
  if (pathnameClassKey) return pathnameClassKey;

  return '';
}

function normalizeCardForStudent(raw: unknown, classKey: ClassKey) {
  const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const videos = Array.isArray(c.videos) ? (c.videos as VideoItem[]) : [];
  const audios = Array.isArray(c.audios) ? (c.audios as AudioItem[]) : [];
  const extras = Array.isArray(c.extras) ? (c.extras as ExtraItem[]) : [];

  const videoUrls = videos
    .map((video) => String(video?.url ?? '').trim())
    .filter(Boolean);

  const firstLinkExtra = extras.find((item) => item?.type === 'link');
  const firstTextExtra = extras.find((item) => item?.type === 'text');
  const firstAudio = audios[0];

  const is600 = classKey === '600-monwed' || classKey === '600-tuthu';

  return {
    id: String(c.id ?? ''),
    createdAt: String(c.createdAt ?? ''),
    isPinned: Boolean(c.isPinned),

    dayLabel: String(c.dayLabel ?? ''),
    dateLabel: String(c.dateLabel ?? ''),
    noticeText: String(c.noticeText ?? ''),

    videos,
    audios,
    extras,

    memoText: String(c.memoText ?? ''),

    title: String(c.title ?? c.dayLabel ?? ''),
    description: String(c.description ?? ''),
    linkUrl: String(c.linkUrl ?? ''),
    type: String(c.type ?? 'lesson_day'),

    materialTitle: String(c.materialTitle ?? ''),
    materialUrl: String(c.materialUrl ?? ''),

    audioTitle: String(c.audioTitle ?? firstAudio?.title ?? ''),
    audioUrl: String(c.audioUrl ?? firstAudio?.url ?? ''),

    linkTitle: String(c.linkTitle ?? firstLinkExtra?.linkTitle ?? ''),
    homeworkText: String(
      c.homeworkText ??
        (firstTextExtra?.text ? String(firstTextExtra.text) : '')
    ),

    audioTitlesText: String(c.audioTitlesText ?? '수업음원'),
    videoTitlesText: String(c.videoTitlesText ?? '오늘 수업영상'),
    extraMaterialTitlesText: String(c.extraMaterialTitlesText ?? '기타'),
    videoUrlsText: String(c.videoUrlsText ?? videoUrls.join('\n')),

    classMode: is600 ? '600' : '800',
  };
}

export async function GET(request: NextRequest) {
  try {
    const classKey = resolveClassKey(request);

    if (!classKey) {
      return NextResponse.json(
        { success: false, message: 'classKey가 필요합니다.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('class_updates')
      .select('class_key, global_notice_text, cards')
      .eq('class_key', classKey)
      .maybeSingle();

    if (error) {
      console.error('get-class-updates-for-student error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const row = data as ClassUpdateRow | null;

    const normalizedCards = row && Array.isArray(row.cards)
      ? row.cards.map((card) => normalizeCardForStudent(card, classKey))
      : [];

    const item = {
      globalNoticeText: row?.global_notice_text || '',
      cards: normalizedCards,
    };

    const updates = {
      '600-monwed': { globalNoticeText: '', cards: [] as typeof normalizedCards },
      '600-tuthu': { globalNoticeText: '', cards: [] as typeof normalizedCards },
      '800-monwed': { globalNoticeText: '', cards: [] as typeof normalizedCards },
      '800-tuthu': { globalNoticeText: '', cards: [] as typeof normalizedCards },
      [classKey]: item,
    };

    return NextResponse.json({
      success: true,
      classKey,

      // 새 구조
      item,
      classUpdate: item,

      // 옛 페이지 호환 구조
      items: normalizedCards,
      cards: normalizedCards,
      data: normalizedCards,
      updates,
    });
  } catch (error) {
    console.error('get-class-updates-for-student catch error:', error);

    return NextResponse.json(
      { success: false, message: '반별 자료를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}