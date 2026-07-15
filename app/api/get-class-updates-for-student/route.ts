import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH } from '../../../lib/operating-month';
import {
  accessRangeKey,
  fetchStudentClassAccessRanges,
} from '../../../lib/student-class-access-ranges';
import {
  fetchStudentMonthPermissions,
  getPermissionMapForOwner,
  isMissingClassKeysByMonthColumnError,
  normalizeClassKeysByMonth,
} from '../../../lib/student-month-permissions';

type ClassUpdateRow = {
  class_key: string;
  year_month: string | null;
  global_notice_text: string | null;
  cards: unknown[] | null;
};

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type StudentAccountRow = {
  student_id: string | null;
  username: string;
  class_key: string | null;
  class_keys: string[] | null;
  class_keys_by_month?: Record<string, string[]> | null;
  month_key: string | null;
  is_active: boolean;
};

const STUDENT_VISIBLE_YEAR_MONTH = OPERATING_YEAR_MONTH;

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

function isMissingYearMonthError(error: unknown) {
  const item = error as { code?: string; message?: string } | null;
  return item?.code === '42703' || String(item?.message ?? '').includes('year_month');
}

function normalizeClassKeyArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

function hasStudentClassAccess(
  row: StudentAccountRow,
  permissionRows: Awaited<ReturnType<typeof fetchStudentMonthPermissions>>,
  yearMonth: string,
  classKey: ClassKey
) {
  const classKeysByMonth = {
    ...normalizeClassKeysByMonth(row.class_keys_by_month),
    ...getPermissionMapForOwner(
      { studentId: row.student_id, username: row.username },
      permissionRows
    ),
  };

  if (Object.prototype.hasOwnProperty.call(classKeysByMonth, yearMonth)) {
    return normalizeClassKeyArray(classKeysByMonth[yearMonth]).includes(classKey);
  }

  return false;
}

async function findStudentForRequest(request: NextRequest) {
  const username = String(request.nextUrl.searchParams.get('username') ?? '').trim();
  const studentId = String(request.nextUrl.searchParams.get('studentId') ?? '').trim();

  if (!username && !studentId) {
    return { student: null as StudentAccountRow | null, error: null as unknown };
  }

  let data: unknown = null;
  let error: unknown = null;

  if (username) {
    const result = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, class_key, class_keys, class_keys_by_month, month_key, is_active'
      )
      .eq('username', username)
      .maybeSingle();

    data = result.data;
    error = result.error;

    if (isMissingClassKeysByMonthColumnError(error)) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select('student_id, username, class_key, class_keys, month_key, is_active')
        .eq('username', username)
        .maybeSingle();

      data = legacyResult.data;
      error = legacyResult.error;
    }
  }

  if (!data && !error && studentId) {
    const result = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, class_key, class_keys, class_keys_by_month, month_key, is_active'
      )
      .eq('student_id', studentId)
      .maybeSingle();

    data = result.data;
    error = result.error;

    if (isMissingClassKeysByMonthColumnError(error)) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select('student_id, username, class_key, class_keys, month_key, is_active')
        .eq('student_id', studentId)
        .maybeSingle();

      data = legacyResult.data;
      error = legacyResult.error;
    }
  }

  return { student: (data as StudentAccountRow | null) ?? null, error };
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

function filterCardsByAccessRange(
  cards: ReturnType<typeof normalizeCardForStudent>[],
  range:
    | {
        startCardId: string | null;
        startOrder: number | null;
      }
    | null
) {
  if (!range?.startCardId && !range?.startOrder) {
    return cards;
  }

  const startCardId = String(range.startCardId ?? '').trim();
  const startIndex = startCardId
    ? cards.findIndex((card) => String(card.id ?? '').trim() === startCardId)
    : -1;

  if (startIndex >= 0) {
    return cards.slice(startIndex);
  }

  const startOrder = Number(range.startOrder);
  if (Number.isFinite(startOrder) && startOrder > 1) {
    return cards.filter((_, index) => index + 1 >= startOrder);
  }

  return cards;
}

export async function GET(request: NextRequest) {
  try {
    const classKey = resolveClassKey(request);
    const yearMonth = STUDENT_VISIBLE_YEAR_MONTH;

    if (!classKey) {
      return NextResponse.json(
        { success: false, message: 'classKey가 필요합니다.' },
        { status: 400 }
      );
    }

    const { student, error: studentError } = await findStudentForRequest(request);

    if (studentError) {
      console.error('get-class-updates-for-student student select error:', studentError);

      return NextResponse.json(
        { success: false, message: 'Student access could not be checked.' },
        { status: 500 }
      );
    }

    if (student) {
      if (!student.is_active) {
        return NextResponse.json(
          { success: false, message: 'Student account is inactive.' },
          { status: 403 }
        );
      }

      const permissionRows = await fetchStudentMonthPermissions();
      if (permissionRows.error) {
        console.error('student_month_permissions student class API error:', permissionRows.error);

        return NextResponse.json(
          { success: false, message: 'Student access could not be checked.' },
          { status: 500 }
        );
      }

      if (!hasStudentClassAccess(student, permissionRows, yearMonth, classKey)) {
        return NextResponse.json(
          { success: false, message: 'Student does not have access to this class.' },
          { status: 403 }
        );
      }
    }

    let { data, error } = await supabaseAdmin
      .from('class_updates')
      .select('class_key, year_month, global_notice_text, cards')
      .eq('class_key', classKey)
      .eq('year_month', yearMonth)
      .maybeSingle();

    if (error) {
      if (isMissingYearMonthError(error)) {
        data = null;
        error = null;
      }
    }

    if (error) {
      console.error('get-class-updates-for-student error:', error);

      return NextResponse.json(
        { success: false, message: '반별 자료를 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const row = data as ClassUpdateRow | null;

    const normalizedCardsBeforeAccessRange = row && Array.isArray(row.cards)
      ? row.cards.map((card) => normalizeCardForStudent(card, classKey))
      : [];
    const studentId = String(student?.student_id ?? '').trim();
    const accessRanges = studentId
      ? await fetchStudentClassAccessRanges(studentId)
      : null;

    if (accessRanges?.error) {
      console.error('student_class_access_ranges student API error:', accessRanges.error);

      return NextResponse.json(
        { success: false, message: 'Student access range could not be checked.' },
        { status: 500 }
      );
    }

    const accessRange = studentId
      ? accessRanges?.byKey.get(accessRangeKey(studentId, yearMonth, classKey)) ?? null
      : null;
    const normalizedCards = filterCardsByAccessRange(
      normalizedCardsBeforeAccessRange,
      accessRange
    );

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
      monthKey: row?.year_month || yearMonth,
      yearMonth: row?.year_month || yearMonth,

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
