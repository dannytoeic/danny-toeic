import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import {
  makeTodayHomeworkSetId,
  TodayHomeworkCard,
  TodayHomeworkCardType,
  TodayHomeworkSet,
  TodayHomeworkTrack,
} from '../../../lib/today-homework';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SET_KEY_PREFIX = 'today_homework_set_';
const PROGRESS_KEY_PREFIX = 'today_homework_progress_';
const CARD_TYPES = new Set<TodayHomeworkCardType>([
  'preposition', 'meaning', 'part-of-speech', 'method', 'condition', 'general',
]);

function safePart(value: unknown) {
  return String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
}

function normalizeCards(value: unknown): TodayHomeworkCard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const requestedType = String(row.type ?? 'general') as TodayHomeworkCardType;
    return {
      id: String(row.id ?? `today-homework-card-${index + 1}`),
      type: CARD_TYPES.has(requestedType) ? requestedType : 'general',
      prompt: String(row.prompt ?? '').trim(),
      question: String(row.question ?? '').trim(),
      answer: String(row.answer ?? '').trim(),
      note: String(row.note ?? '').trim(),
      speakText: String(row.speakText ?? '').trim() || undefined,
    };
  }).filter((card) => card.prompt && card.answer);
}

function normalizeSet(value: unknown): TodayHomeworkSet | null {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const track = String(row.track ?? '') as TodayHomeworkTrack;
  const dayNumber = Number(row.dayNumber);
  if (!['A', 'B'].includes(track) || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 100) return null;
  return {
    id: makeTodayHomeworkSetId(track, dayNumber),
    level: '600',
    track,
    dayNumber,
    title: String(row.title ?? `${track} Day${dayNumber}`).trim(),
    rawText: String(row.rawText ?? ''),
    cards: normalizeCards(row.cards),
    isActive: row.isActive !== false,
    updatedAt: String(row.updatedAt ?? '') || undefined,
  };
}

function parseSet(value: unknown) {
  try {
    return normalizeSet(JSON.parse(String(value ?? '')));
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const track = url.searchParams.get('track');
    const adminMode = url.searchParams.get('admin') === '1';
    const { data, error } = await supabaseAdmin
      .from('site_notices')
      .select('notice_key, content_text, updated_at')
      .like('notice_key', `${SET_KEY_PREFIX}%`);

    if (error) throw error;
    const sets = (Array.isArray(data) ? data : [])
      .map((row) => {
        const set = parseSet(row.content_text);
        return set ? { ...set, updatedAt: String(row.updated_at ?? set.updatedAt ?? '') } : null;
      })
      .filter((set) => set !== null)
      .filter((set) => (!track || set.track === track) && (adminMode || set.isActive))
      .sort((a, b) => a.track.localeCompare(b.track) || a.dayNumber - b.dayNumber);

    return NextResponse.json({ success: true, sets });
  } catch (error) {
    console.error('today-homework GET error:', error);
    return NextResponse.json({ success: false, message: '오늘홈트 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? 'save-set');

    if (action === 'save-set') {
      const set = normalizeSet(body.set);
      if (!set || set.cards.length === 0) {
        return NextResponse.json({ success: false, message: '트랙, Day, 생성된 카드를 확인해 주세요.' }, { status: 400 });
      }
      const updatedAt = new Date().toISOString();
      const savedSet = { ...set, updatedAt };
      const { error } = await supabaseAdmin.from('site_notices').upsert({
        notice_key: `${SET_KEY_PREFIX}${set.track}_day${set.dayNumber}`,
        title: set.title,
        content_text: JSON.stringify(savedSet),
        updated_at: updatedAt,
      }, { onConflict: 'notice_key' });
      if (error) throw error;
      return NextResponse.json({ success: true, set: savedSet });
    }

    if (action === 'delete-set') {
      const track = String(body.track ?? '') as TodayHomeworkTrack;
      const dayNumber = Number(body.dayNumber);
      if (!['A', 'B'].includes(track) || !Number.isInteger(dayNumber)) {
        return NextResponse.json({ success: false, message: '삭제할 세트를 확인해 주세요.' }, { status: 400 });
      }
      const { error } = await supabaseAdmin.from('site_notices').delete().eq('notice_key', `${SET_KEY_PREFIX}${track}_day${dayNumber}`);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'save-progress') {
      const studentId = safePart(body.studentId);
      const setId = safePart(body.setId);
      if (!studentId || !setId) {
        return NextResponse.json({ success: false, message: '학습 기록 정보가 올바르지 않습니다.' }, { status: 400 });
      }
      const progress = {
        studentId,
        setId,
        correctCount: Math.max(0, Number(body.correctCount) || 0),
        wrongCount: Math.max(0, Number(body.wrongCount) || 0),
        wrongCardIds: Array.isArray(body.wrongCardIds) ? body.wrongCardIds.map(String) : [],
        completedAt: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from('site_notices').upsert({
        notice_key: `${PROGRESS_KEY_PREFIX}${studentId}_${setId}`,
        title: '오늘홈트 완료 기록',
        content_text: JSON.stringify(progress),
        updated_at: progress.completedAt,
      }, { onConflict: 'notice_key' });
      if (error) throw error;
      return NextResponse.json({ success: true, progress });
    }

    return NextResponse.json({ success: false, message: '지원하지 않는 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('today-homework POST error:', error);
    return NextResponse.json({ success: false, message: '오늘홈트 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
