import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH, normalizeYearMonth } from '../../../lib/operating-month';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type VideoRole = 'rc' | 'lc' | 'main' | 'extra';
type AudioCategory = 'class' | 'homework' | 'memorize' | 'extra';
type ExtraType = 'text' | 'image' | 'link';

type VideoItem = {
  id: string;
  role: VideoRole;
  url: string;
};

type AudioItem = {
  id: string;
  category: AudioCategory;
  title: string;
  url: string;
};

type ExtraItem = {
  id: string;
  type: ExtraType;
  text: string;
  imageUrl: string;
  linkTitle: string;
  linkUrl: string;
};

type ClassCard = {
  id: string;
  createdAt: string;
  isPinned: boolean;
  dayLabel: string;
  dateLabel: string;
  noticeText: string;
  videos: VideoItem[];
  audios: AudioItem[];
  extras: ExtraItem[];
  memoText: string;
  title: string;
  description: string;
  linkUrl: string;
  type: string;
  materialTitle: string;
  materialUrl: string;
  audioTitle: string;
  audioUrl: string;
  linkTitle: string;
  homeworkText: string;
  audioTitlesText: string;
  videoUrlsText: string;
  videoTitlesText: string;
  extraMaterialTitlesText: string;
};

type ClassUpdateRow = {
  year_month: string;
  class_key: ClassKey;
  global_notice_text: string | null;
  cards: unknown[] | null;
};

const DEFAULT_YEAR_MONTH = OPERATING_YEAR_MONTH;

const classKeys: ClassKey[] = [
  '600-monwed',
  '600-tuthu',
  '800-monwed',
  '800-tuthu',
];

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isClassKey(value: unknown): value is ClassKey {
  return typeof value === 'string' && classKeys.includes(value as ClassKey);
}

function normalizeVideoRole(value: unknown): VideoRole {
  return value === 'rc' || value === 'lc' || value === 'main' || value === 'extra'
    ? value
    : 'main';
}

function normalizeAudioCategory(value: unknown): AudioCategory {
  return value === 'class' ||
    value === 'homework' ||
    value === 'memorize' ||
    value === 'extra'
    ? value
    : 'class';
}

function normalizeExtraType(value: unknown): ExtraType {
  return value === 'text' || value === 'image' || value === 'link' ? value : 'text';
}

function createVideo(role: VideoRole): VideoItem {
  return {
    id: makeId('video'),
    role,
    url: '',
  };
}

function defaultVideosForClass(classKey: ClassKey): VideoItem[] {
  if (classKey === '600-monwed' || classKey === '600-tuthu') {
    return [createVideo('rc'), createVideo('lc')];
  }

  return [createVideo('main')];
}

function normalizeVideos(raw: unknown, classKey: ClassKey): VideoItem[] {
  if (!Array.isArray(raw)) {
    return defaultVideosForClass(classKey);
  }

  const videos = raw.map((item) => {
    const row = isRecord(item) ? item : {};

    return {
      id: String(row.id ?? makeId('video')),
      role: normalizeVideoRole(row.role),
      url: String(row.url ?? ''),
    };
  });

  return videos.length > 0 ? videos : defaultVideosForClass(classKey);
}

function normalizeAudios(raw: unknown): AudioItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const row = isRecord(item) ? item : {};

    return {
      id: String(row.id ?? makeId('audio')),
      category: normalizeAudioCategory(row.category),
      title: String(row.title ?? ''),
      url: String(row.url ?? ''),
    };
  });
}

function normalizeExtras(raw: unknown): ExtraItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((item) => {
    const row = isRecord(item) ? item : {};

    return {
      id: String(row.id ?? makeId('extra')),
      type: normalizeExtraType(row.type),
      text: String(row.text ?? ''),
      imageUrl: String(row.imageUrl ?? ''),
      linkTitle: String(row.linkTitle ?? ''),
      linkUrl: String(row.linkUrl ?? ''),
    };
  });
}

function normalizeCard(raw: unknown, classKey: ClassKey): ClassCard {
  const card = isRecord(raw) ? raw : {};

  return {
    id: String(card.id ?? makeId('card')),
    createdAt: String(card.createdAt ?? new Date().toISOString()),
    isPinned: Boolean(card.isPinned),
    dayLabel: String(card.dayLabel ?? ''),
    dateLabel: String(card.dateLabel ?? ''),
    noticeText: String(card.noticeText ?? ''),
    videos: normalizeVideos(card.videos, classKey),
    audios: normalizeAudios(card.audios),
    extras: normalizeExtras(card.extras),
    memoText: String(card.memoText ?? ''),
    title: String(card.title ?? ''),
    description: String(card.description ?? ''),
    linkUrl: String(card.linkUrl ?? ''),
    type: String(card.type ?? 'lesson_day'),
    materialTitle: String(card.materialTitle ?? ''),
    materialUrl: String(card.materialUrl ?? ''),
    audioTitle: String(card.audioTitle ?? ''),
    audioUrl: String(card.audioUrl ?? ''),
    linkTitle: String(card.linkTitle ?? ''),
    homeworkText: String(card.homeworkText ?? ''),
    audioTitlesText: String(card.audioTitlesText ?? ''),
    videoUrlsText: String(card.videoUrlsText ?? ''),
    videoTitlesText: String(card.videoTitlesText ?? ''),
    extraMaterialTitlesText: String(card.extraMaterialTitlesText ?? ''),
  };
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.DANNY_ADMIN_SECRET;
  const incomingSecret = request.headers.get('x-danny-admin-secret');

  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { ok: false, message: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }

    if (!isClassKey(body.classKey)) {
      return NextResponse.json(
        { ok: false, message: 'classKey must be one of 600-monwed, 600-tuthu, 800-monwed, 800-tuthu.' },
        { status: 400 }
      );
    }

    if (!isRecord(body.card)) {
      return NextResponse.json(
        { ok: false, message: 'card must be a JSON object.' },
        { status: 400 }
      );
    }

    const classKey = body.classKey;
    const yearMonth = normalizeYearMonth(body.yearMonth ?? body.monthKey);
    const newCard = normalizeCard(body.card, classKey);

    const { data, error: selectError } = await supabaseAdmin
      .from('class_updates')
      .select('year_month, class_key, global_notice_text, cards')
      .eq('year_month', yearMonth)
      .eq('class_key', classKey)
      .maybeSingle();

    if (selectError) {
      console.error('add-class-update-card select error:', selectError);

      return NextResponse.json(
        { ok: false, message: 'Failed to load class update row.' },
        { status: 500 }
      );
    }

    const row = data as ClassUpdateRow | null;
    const existingCards = row && Array.isArray(row.cards) ? row.cards : [];
    const nextCards = [newCard, ...existingCards];

    const upsertRow = {
      year_month: yearMonth,
      class_key: classKey,
      global_notice_text: row?.global_notice_text ?? '',
      cards: nextCards,
    };

    const { error: upsertError } = await supabaseAdmin
      .from('class_updates')
      .upsert(upsertRow, { onConflict: 'year_month,class_key' });

    if (upsertError) {
      console.error('add-class-update-card upsert error:', upsertError);

      return NextResponse.json(
        { ok: false, message: 'Failed to save class update card.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      yearMonth,
      classKey,
      card: newCard,
      cardsCount: nextCards.length,
    });
  } catch (error) {
    console.error('add-class-update-card catch error:', error);

    return NextResponse.json(
      { ok: false, message: 'Failed to add class update card.' },
      { status: 500 }
    );
  }
}
