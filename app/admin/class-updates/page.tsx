'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '../AdminShell';
import { getLoggedInAdmin } from '../adminGuard';

type ClassKey = '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';

type VideoItem = {
  id: string;
  role: 'rc' | 'lc' | 'main' | 'extra';
  url: string;
};

type AudioItem = {
  id: string;
  category: 'class' | 'homework' | 'memorize' | 'extra';
  title: string;
  url: string;
};

type ExtraItem = {
  id: string;
  type: 'text' | 'image' | 'link';
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
  videos?: VideoItem[];
  audios?: AudioItem[];
  extras?: ExtraItem[];
  memoText?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  type?: string;
  materialTitle?: string;
  materialUrl?: string;
  audioTitle?: string;
  audioUrl?: string;
  linkTitle?: string;
  homeworkText?: string;
  audioTitlesText?: string;
  videoUrlsText?: string;
  videoTitlesText?: string;
  extraMaterialTitlesText?: string;
};

type ClassUpdateItem = {
  globalNoticeText: string;
  cards: ClassCard[];
};

type ClassUpdateMap = Record<ClassKey, ClassUpdateItem>;

const CLASS_OPTIONS: Array<{ key: ClassKey; label: string; mode: '600' | '800' }> = [
  { key: '600-monwed', label: '600 월수반', mode: '600' },
  { key: '600-tuthu', label: '600 화목반', mode: '600' },
  { key: '800-monwed', label: '800 월수반', mode: '800' },
  { key: '800-tuthu', label: '800 화목반', mode: '800' },
];

function buildEmptyData(): ClassUpdateMap {
  return {
    '600-monwed': { globalNoticeText: '', cards: [] },
    '600-tuthu': { globalNoticeText: '', cards: [] },
    '800-monwed': { globalNoticeText: '', cards: [] },
    '800-tuthu': { globalNoticeText: '', cards: [] },
  };
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createVideo(role: VideoItem['role']): VideoItem {
  return {
    id: makeId('video'),
    role,
    url: '',
  };
}

function createAudio(category: AudioItem['category'] = 'class'): AudioItem {
  return {
    id: makeId('audio'),
    category,
    title: '',
    url: '',
  };
}

function createExtra(type: ExtraItem['type'] = 'text'): ExtraItem {
  return {
    id: makeId('extra'),
    type,
    text: '',
    imageUrl: '',
    linkTitle: '',
    linkUrl: '',
  };
}

function createEmptyCard(mode: '600' | '800'): ClassCard {
  const baseVideos =
    mode === '600' ? [createVideo('rc'), createVideo('lc')] : [createVideo('main')];

  return {
    id: makeId('card'),
    createdAt: new Date().toISOString(),
    isPinned: false,
    dayLabel: '',
    dateLabel: '',
    noticeText: '',
    videos: baseVideos,
    audios: [],
    extras: [],
    memoText: '',
    title: '',
    description: '',
    linkUrl: '',
    type: 'lesson_day',
    materialTitle: '',
    materialUrl: '',
    audioTitle: '',
    audioUrl: '',
    linkTitle: '',
    homeworkText: '',
    audioTitlesText: '',
    videoUrlsText: '',
    videoTitlesText: '',
    extraMaterialTitlesText: '',
  };
}

function cloneCard(card: ClassCard, mode: '600' | '800'): ClassCard {
  const clonedVideos = normalizeVideos(card.videos ?? [], mode).map((video) => ({
    ...video,
    id: makeId('video'),
  }));

  const clonedAudios = normalizeAudios(card.audios ?? []).map((audio) => ({
    ...audio,
    id: makeId('audio'),
  }));

  const clonedExtras = normalizeExtras(card.extras ?? []).map((extra) => ({
    ...extra,
    id: makeId('extra'),
  }));

  return {
    ...card,
    id: makeId('card'),
    createdAt: new Date().toISOString(),
    isPinned: false,
    videos: clonedVideos,
    audios: clonedAudios,
    extras: clonedExtras,
  };
}

function normalizeVideos(raw: unknown, mode: '600' | '800'): VideoItem[] {
  const list = Array.isArray(raw)
    ? raw.map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const roleRaw = String(row.role ?? 'extra');
        const role: VideoItem['role'] =
          roleRaw === 'rc' || roleRaw === 'lc' || roleRaw === 'main' || roleRaw === 'extra'
            ? roleRaw
            : 'extra';

        return {
          id: String(row.id ?? makeId('video')),
          role,
          url: String(row.url ?? ''),
        };
      })
    : [];

  if (mode === '600') {
    const hasRc = list.some((v) => v.role === 'rc');
    const hasLc = list.some((v) => v.role === 'lc');
    if (!hasRc) list.unshift(createVideo('rc'));
    if (!hasLc) list.push(createVideo('lc'));
  } else {
    const hasMain = list.some((v) => v.role === 'main');
    if (!hasMain) list.unshift(createVideo('main'));
  }

  return list;
}

function normalizeAudios(raw: unknown): AudioItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const categoryRaw = String(row.category ?? 'class');
    const category: AudioItem['category'] =
      categoryRaw === 'class' ||
      categoryRaw === 'homework' ||
      categoryRaw === 'memorize' ||
      categoryRaw === 'extra'
        ? categoryRaw
        : 'class';

    return {
      id: String(row.id ?? makeId('audio')),
      category,
      title: String(row.title ?? ''),
      url: String(row.url ?? ''),
    };
  });
}

function normalizeExtras(raw: unknown): ExtraItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const typeRaw = String(row.type ?? 'text');
    const type: ExtraItem['type'] =
      typeRaw === 'text' || typeRaw === 'image' || typeRaw === 'link' ? typeRaw : 'text';

    return {
      id: String(row.id ?? makeId('extra')),
      type,
      text: String(row.text ?? ''),
      imageUrl: String(row.imageUrl ?? ''),
      linkTitle: String(row.linkTitle ?? ''),
      linkUrl: String(row.linkUrl ?? ''),
    };
  });
}

function normalizeData(raw: unknown): ClassUpdateMap {
  const base = buildEmptyData();

  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Record<string, unknown>;

  for (const option of CLASS_OPTIONS) {
    const source = obj[option.key];
    if (!source || typeof source !== 'object') continue;

    const item = source as Record<string, unknown>;

    base[option.key] = {
      globalNoticeText: String(item.globalNoticeText ?? ''),
      cards: Array.isArray(item.cards)
        ? item.cards.map((card) => {
            const c = card && typeof card === 'object' ? (card as Record<string, unknown>) : {};

            return {
              id: String(c.id ?? makeId('card')),
              createdAt: String(c.createdAt ?? new Date().toISOString()),
              isPinned: Boolean(c.isPinned),
              dayLabel: String(c.dayLabel ?? ''),
              dateLabel: String(c.dateLabel ?? ''),
              noticeText: String(c.noticeText ?? ''),
              videos: normalizeVideos(c.videos, option.mode),
              audios: normalizeAudios(c.audios),
              extras: normalizeExtras(c.extras),
              memoText: String(c.memoText ?? ''),
              title: String(c.title ?? ''),
              description: String(c.description ?? ''),
              linkUrl: String(c.linkUrl ?? ''),
              type: String(c.type ?? 'lesson_day'),
              materialTitle: String(c.materialTitle ?? ''),
              materialUrl: String(c.materialUrl ?? ''),
              audioTitle: String(c.audioTitle ?? ''),
              audioUrl: String(c.audioUrl ?? ''),
              linkTitle: String(c.linkTitle ?? ''),
              homeworkText: String(c.homeworkText ?? ''),
              audioTitlesText: String(c.audioTitlesText ?? ''),
              videoUrlsText: String(c.videoUrlsText ?? ''),
              videoTitlesText: String(c.videoTitlesText ?? ''),
              extraMaterialTitlesText: String(c.extraMaterialTitlesText ?? ''),
            } as ClassCard;
          })
        : [],
    };
  }

  return base;
}

function sortCards(cards: ClassCard[]) {
  const pinned = cards.filter((card) => card.isPinned);
  const normal = cards.filter((card) => !card.isPinned);
  return [...pinned, ...normal];
}

export default function ClassUpdatesAdminPage() {
  const router = useRouter();

  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [selectedClassKey, setSelectedClassKey] = useState<ClassKey>('600-monwed');
  const [dataMap, setDataMap] = useState<ClassUpdateMap>(buildEmptyData());
  const [collapsedCardIds, setCollapsedCardIds] = useState<string[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState('');

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  async function loadData() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/get-class-updates', { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '반별 자료를 불러오지 못했습니다.');
        const empty = buildEmptyData();
        setDataMap(empty);
        setSavedSnapshot(JSON.stringify(empty));
        return;
      }

      const normalized = normalizeData(result.items ?? result.classUpdates ?? {});
      setDataMap(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
    } catch (error) {
      console.error(error);
      setMessage('반별 자료를 불러오는 중 오류가 발생했습니다.');
      const empty = buildEmptyData();
      setDataMap(empty);
      setSavedSnapshot(JSON.stringify(empty));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isChecking) return;
    loadData();
  }, [isChecking]);

  useEffect(() => {
    setCollapsedCardIds([]);
  }, [selectedClassKey]);

  const selectedMeta = CLASS_OPTIONS.find((item) => item.key === selectedClassKey)!;
  const selectedItem = dataMap[selectedClassKey];
  const sortedCards = useMemo(() => sortCards(selectedItem.cards), [selectedItem.cards]);

  const currentSnapshot = useMemo(() => JSON.stringify(dataMap), [dataMap]);
  const isDirty = !isLoading && savedSnapshot !== '' && currentSnapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  function isCollapsed(cardId: string) {
    return collapsedCardIds.includes(cardId);
  }

  function toggleCollapse(cardId: string) {
    setCollapsedCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }

  function collapseAllCards() {
    setCollapsedCardIds(sortedCards.map((card) => card.id));
  }

  function expandAllCards() {
    setCollapsedCardIds([]);
  }

  function updateGlobalNoticeText(value: string) {
    setDataMap((prev) => ({
      ...prev,
      [selectedClassKey]: {
        ...prev[selectedClassKey],
        globalNoticeText: value,
      },
    }));
  }

  function replaceCards(nextCards: ClassCard[]) {
    setDataMap((prev) => ({
      ...prev,
      [selectedClassKey]: {
        ...prev[selectedClassKey],
        cards: nextCards,
      },
    }));
  }

  function moveCard(cardId: string, direction: 'up' | 'down') {
    const cards = [...selectedItem.cards];
    const index = cards.findIndex((card) => card.id === cardId);
    if (index === -1) return;

    const current = cards[index];

    if (direction === 'up') {
      for (let i = index - 1; i >= 0; i -= 1) {
        if (cards[i].isPinned === current.isPinned) {
          const temp = cards[i];
          cards[i] = cards[index];
          cards[index] = temp;
          replaceCards(cards);
          return;
        }
      }
      return;
    }

    for (let i = index + 1; i < cards.length; i += 1) {
      if (cards[i].isPinned === current.isPinned) {
        const temp = cards[i];
        cards[i] = cards[index];
        cards[index] = temp;
        replaceCards(cards);
        return;
      }
    }
  }

  function updateCard(cardId: string, patch: Partial<ClassCard>) {
    replaceCards(
      selectedItem.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card))
    );
  }

  function addCard() {
    const newCard = createEmptyCard(selectedMeta.mode);
    replaceCards([newCard, ...selectedItem.cards]);
    setCollapsedCardIds((prev) => prev.filter((id) => id !== newCard.id));
    setMessage('');
  }

  function duplicateCard(cardId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    const duplicated = cloneCard(target, selectedMeta.mode);
    const nextCards: ClassCard[] = [];

    for (const card of selectedItem.cards) {
      nextCards.push(card);
      if (card.id === cardId) {
        nextCards.push(duplicated);
      }
    }

    replaceCards(nextCards);
    setCollapsedCardIds((prev) => prev.filter((id) => id !== duplicated.id));
    setMessage('카드를 복제했습니다.');
  }

  function deleteCard(cardId: string) {
    const ok = window.confirm('이 카드를 삭제하시겠습니까?');
    if (!ok) return;
    replaceCards(selectedItem.cards.filter((card) => card.id !== cardId));
    setCollapsedCardIds((prev) => prev.filter((id) => id !== cardId));
    setMessage('');
  }

  function updateVideo(cardId: string, videoId: string, patch: Partial<VideoItem>) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      videos: (target.videos ?? []).map((video) =>
        video.id === videoId ? { ...video, ...patch } : video
      ),
    });
  }

  function addExtraVideo(cardId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      videos: [...(target.videos ?? []), createVideo('extra')],
    });
  }

  function deleteVideo(cardId: string, videoId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    const targetVideo = (target.videos ?? []).find((video) => video.id === videoId);
    if (!targetVideo) return;

    if (targetVideo.role === 'rc' || targetVideo.role === 'lc' || targetVideo.role === 'main') {
      updateVideo(cardId, videoId, { url: '' });
      return;
    }

    updateCard(cardId, {
      videos: (target.videos ?? []).filter((video) => video.id !== videoId),
    });
  }

  function updateAudio(cardId: string, audioId: string, patch: Partial<AudioItem>) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      audios: (target.audios ?? []).map((audio) =>
        audio.id === audioId ? { ...audio, ...patch } : audio
      ),
    });
  }

  function addAudio(cardId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      audios: [...(target.audios ?? []), createAudio()],
    });
  }

  function deleteAudio(cardId: string, audioId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      audios: (target.audios ?? []).filter((audio) => audio.id !== audioId),
    });
  }

  function updateExtra(cardId: string, extraId: string, patch: Partial<ExtraItem>) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      extras: (target.extras ?? []).map((extra) =>
        extra.id === extraId ? { ...extra, ...patch } : extra
      ),
    });
  }

  function addExtra(cardId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      extras: [...(target.extras ?? []), createExtra()],
    });
  }

  function deleteExtra(cardId: string, extraId: string) {
    const target = selectedItem.cards.find((card) => card.id === cardId);
    if (!target) return;

    updateCard(cardId, {
      extras: (target.extras ?? []).filter((extra) => extra.id !== extraId),
    });
  }

  async function saveAll() {
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/save-class-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: dataMap }),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '반별 자료 저장에 실패했습니다.');
        return;
      }

      const normalized = normalizeData(result.items ?? result.classUpdates ?? dataMap);
      setDataMap(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setMessage('반별 자료가 저장되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('반별 자료 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  const pageWrapStyle: React.CSSProperties = {
    maxWidth: '1240px',
    display: 'grid',
    gap: '18px',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
  };

  const boxStyle: React.CSSProperties = {
    backgroundColor: '#fafaf9',
    border: '1px solid #e5e7eb',
    borderRadius: '15px',
    padding: '14px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#111827',
    outline: 'none',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '92px',
    resize: 'vertical',
    lineHeight: 1.55,
  };

  const tallTextareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '128px',
    resize: 'vertical',
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    marginBottom: '6px',
    fontWeight: 800,
    color: '#111827',
    fontSize: '13px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '17px',
    fontWeight: 800,
    color: '#111827',
    letterSpacing: '-0.01em',
  };

  const helperStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '13px',
    lineHeight: 1.55,
  };

  const normalButtonStyle: React.CSSProperties = {
    padding: '10px 13px',
    borderRadius: '10px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: '#111827',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    fontSize: '13px',
    boxShadow: '0 6px 16px rgba(17, 24, 39, 0.12)',
  };

  const dangerButtonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1px solid #fecaca',
    backgroundColor: '#ffffff',
    color: '#991b1b',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
  };

  if (isChecking || isLoading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
        }}
      >
        반별 자료 불러오는 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="반별 하루치 수업 관리"
      description="600반/800반 운영 방식에 맞춰 하루치 카드 단위로 공지, 영상, 음원, 기타 블록을 관리합니다."
    >
      <div style={pageWrapStyle}>
        {message && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#475569',
              fontWeight: 700,
              fontSize: '13px',
            }}
          >
            {message}
          </div>
        )}

        {isDirty ? (
          <div
            style={{
              backgroundColor: '#fff7ed',
              border: '1px solid #fdba74',
              borderRadius: '14px',
              padding: '12px 14px',
              color: '#9a3412',
              fontWeight: 800,
              fontSize: '13px',
            }}
          >
            저장되지 않은 변경사항이 있습니다. 저장 후 이동하거나 새로고침하세요.
          </div>
        ) : null}

        <section style={panelStyle}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '14px',
              alignItems: 'end',
            }}
          >
            <div style={{ display: 'grid', gap: '6px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#111827' }}>
                현재 편집 반
              </div>
              <div style={helperStyle}>
                반을 선택하고 하루치 카드, 전체공지, 영상, 음원, 기타 블록을 한 화면에서 관리하세요.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <select
                value={selectedClassKey}
                onChange={(e) => setSelectedClassKey(e.target.value as ClassKey)}
                style={{ ...inputStyle, minWidth: '210px' }}
              >
                {CLASS_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button onClick={addCard} style={normalButtonStyle}>
                하루치 카드 추가
              </button>

              <button onClick={collapseAllCards} style={normalButtonStyle}>
                모두 접기
              </button>

              <button onClick={expandAllCards} style={normalButtonStyle}>
                모두 펼치기
              </button>

              <button
                onClick={saveAll}
                disabled={isSaving}
                style={{ ...primaryButtonStyle, opacity: isSaving ? 0.72 : 1 }}
              >
                {isSaving ? '저장 중...' : isDirty ? '저장하기 *' : '저장하기'}
              </button>
            </div>
          </div>
        </section>

        <section style={panelStyle}>
          <div style={{ ...sectionTitleStyle, marginBottom: '8px' }}>상단 고정 전체공지</div>
          <div style={{ ...helperStyle, marginBottom: '10px' }}>
            학생 페이지에서 맨 위에 노출되는 전체 공지입니다.
          </div>
          <textarea
            value={selectedItem.globalNoticeText}
            onChange={(e) => updateGlobalNoticeText(e.target.value)}
            placeholder={'여러 줄 입력 가능\n예: 결석 시 반드시 연락\n관리반 금요일 진행'}
            style={tallTextareaStyle}
          />
        </section>

        {sortedCards.length === 0 ? (
          <section style={panelStyle}>아직 등록된 하루치 수업 카드가 없습니다.</section>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {sortedCards.map((card, index) => {
              const videos = card.videos ?? [];
              const audios = card.audios ?? [];
              const extras = card.extras ?? [];

              const rcVideo = videos.find((v) => v.role === 'rc');
              const lcVideo = videos.find((v) => v.role === 'lc');
              const mainVideo = videos.find((v) => v.role === 'main');
              const extraVideos = videos.filter((v) => v.role === 'extra');
              const collapsed = isCollapsed(card.id);

              const movableCards = selectedItem.cards.filter((item) => item.isPinned === card.isPinned);
              const movableIndex = movableCards.findIndex((item) => item.id === card.id);
              const canMoveUp = movableIndex > 0;
              const canMoveDown = movableIndex < movableCards.length - 1;

              return (
                <section style={panelStyle} key={card.id}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      marginBottom: collapsed ? '0' : '16px',
                      paddingBottom: collapsed ? '0' : '12px',
                      borderBottom: collapsed ? 'none' : '1px solid #eceff3',
                    }}
                  >
                    <div style={{ display: 'grid', gap: '3px' }}>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: '#111827' }}>
                        카드 {index + 1}
                        {card.dayLabel ? ` · ${card.dayLabel}` : ''}
                      </div>
                      <div style={helperStyle}>
                        {collapsed
                          ? '접힌 상태입니다. 펼쳐서 수정할 수 있습니다.'
                          : 'Day, 날짜, 공지, 영상, 음원, 기타 블록을 이 카드에 묶어서 관리합니다.'}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <button
                        onClick={() => moveCard(card.id, 'up')}
                        disabled={!canMoveUp}
                        style={{
                          ...normalButtonStyle,
                          opacity: canMoveUp ? 1 : 0.45,
                          cursor: canMoveUp ? 'pointer' : 'default',
                        }}
                      >
                        ↑ 위로
                      </button>

                      <button
                        onClick={() => moveCard(card.id, 'down')}
                        disabled={!canMoveDown}
                        style={{
                          ...normalButtonStyle,
                          opacity: canMoveDown ? 1 : 0.45,
                          cursor: canMoveDown ? 'pointer' : 'default',
                        }}
                      >
                        ↓ 아래로
                      </button>

                      <button onClick={() => toggleCollapse(card.id)} style={normalButtonStyle}>
                        {collapsed ? '펼치기' : '접기'}
                      </button>

                      <button onClick={() => duplicateCard(card.id)} style={normalButtonStyle}>
                        카드 복제
                      </button>

                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          backgroundColor: '#ffffff',
                          fontWeight: 700,
                          color: '#334155',
                          fontSize: '13px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(card.isPinned)}
                          onChange={(e) => updateCard(card.id, { isPinned: e.target.checked })}
                        />
                        상단 고정
                      </label>

                      <button onClick={() => deleteCard(card.id)} style={dangerButtonStyle}>
                        삭제
                      </button>
                    </div>
                  </div>

                  {!collapsed ? (
                    <div style={{ display: 'grid', gap: '14px' }}>
                      <div style={boxStyle}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '14px 16px',
                          }}
                        >
                          <div>
                            <div style={labelStyle}>Day</div>
                            <input
                              value={card.dayLabel}
                              onChange={(e) => updateCard(card.id, { dayLabel: e.target.value })}
                              placeholder="Day 1"
                              style={inputStyle}
                            />
                          </div>

                          <div>
                            <div style={labelStyle}>날짜</div>
                            <input
                              value={card.dateLabel}
                              onChange={(e) => updateCard(card.id, { dateLabel: e.target.value })}
                              placeholder="260304 / 3월 5일"
                              style={inputStyle}
                            />
                          </div>

                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={labelStyle}>오늘의 공지</div>
                            <textarea
                              value={card.noticeText}
                              onChange={(e) => updateCard(card.id, { noticeText: e.target.value })}
                              placeholder="여러 줄 입력 가능"
                              style={textareaStyle}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={boxStyle}>
                        <div style={{ ...sectionTitleStyle, marginBottom: '12px' }}>수업영상</div>

                        <div style={{ display: 'grid', gap: '12px' }}>
                          {selectedMeta.mode === '600' ? (
                            <>
                              <div>
                                <div style={labelStyle}>RC 영상</div>
                                <input
                                  value={rcVideo?.url ?? ''}
                                  onChange={(e) =>
                                    rcVideo &&
                                    updateVideo(card.id, rcVideo.id, { url: e.target.value })
                                  }
                                  placeholder="RC 영상 링크"
                                  style={inputStyle}
                                />
                              </div>

                              <div>
                                <div style={labelStyle}>LC 영상</div>
                                <input
                                  value={lcVideo?.url ?? ''}
                                  onChange={(e) =>
                                    lcVideo &&
                                    updateVideo(card.id, lcVideo.id, { url: e.target.value })
                                  }
                                  placeholder="LC 영상 링크"
                                  style={inputStyle}
                                />
                              </div>
                            </>
                          ) : (
                            <div>
                              <div style={labelStyle}>통합 영상</div>
                              <input
                                value={mainVideo?.url ?? ''}
                                onChange={(e) =>
                                  mainVideo &&
                                  updateVideo(card.id, mainVideo.id, { url: e.target.value })
                                }
                                placeholder="통합 영상 링크"
                                style={inputStyle}
                              />
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '10px',
                              flexWrap: 'wrap',
                              paddingTop: '2px',
                            }}
                          >
                            <div style={{ fontWeight: 800, color: '#111827', fontSize: '14px' }}>
                              기타 영상
                            </div>
                            <button onClick={() => addExtraVideo(card.id)} style={normalButtonStyle}>
                              기타 영상 추가
                            </button>
                          </div>

                          {extraVideos.length === 0 ? (
                            <div style={softEmptyStyle()}>등록된 기타 영상이 없습니다.</div>
                          ) : (
                            extraVideos.map((video) => (
                              <div key={video.id} style={softItemStyle()}>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                  <input
                                    value={video.url}
                                    onChange={(e) =>
                                      updateVideo(card.id, video.id, { url: e.target.value })
                                    }
                                    placeholder="기타 영상 링크"
                                    style={inputStyle}
                                  />
                                  <div>
                                    <button
                                      onClick={() => deleteVideo(card.id, video.id)}
                                      style={dangerButtonStyle}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div style={boxStyle}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                            marginBottom: '12px',
                          }}
                        >
                          <div style={sectionTitleStyle}>수업음원</div>
                          <button onClick={() => addAudio(card.id)} style={normalButtonStyle}>
                            음원 추가
                          </button>
                        </div>

                        {audios.length === 0 ? (
                          <div style={softEmptyStyle()}>등록된 수업음원이 없습니다.</div>
                        ) : (
                          <div style={{ display: 'grid', gap: '10px' }}>
                            {audios.map((audio) => (
                              <div key={audio.id} style={softItemStyle()}>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: '160px 1fr 1fr auto',
                                    gap: '8px',
                                    alignItems: 'center',
                                  }}
                                >
                                  <select
                                    value={audio.category}
                                    onChange={(e) =>
                                      updateAudio(card.id, audio.id, {
                                        category: e.target.value as AudioItem['category'],
                                      })
                                    }
                                    style={inputStyle}
                                  >
                                    <option value="class">수업음원</option>
                                    <option value="homework">과제음원</option>
                                    <option value="memorize">문장암기</option>
                                    <option value="extra">기타</option>
                                  </select>

                                  <input
                                    value={audio.title}
                                    onChange={(e) =>
                                      updateAudio(card.id, audio.id, { title: e.target.value })
                                    }
                                    placeholder="음원 제목"
                                    style={inputStyle}
                                  />

                                  <input
                                    value={audio.url}
                                    onChange={(e) =>
                                      updateAudio(card.id, audio.id, { url: e.target.value })
                                    }
                                    placeholder="음원 링크"
                                    style={inputStyle}
                                  />

                                  <button
                                    onClick={() => deleteAudio(card.id, audio.id)}
                                    style={dangerButtonStyle}
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={boxStyle}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '10px',
                            flexWrap: 'wrap',
                            marginBottom: '12px',
                          }}
                        >
                          <div style={sectionTitleStyle}>기타 블록</div>
                          <button onClick={() => addExtra(card.id)} style={normalButtonStyle}>
                            기타 블록 추가
                          </button>
                        </div>

                        {extras.length === 0 ? (
                          <div style={softEmptyStyle()}>등록된 기타 블록이 없습니다.</div>
                        ) : (
                          <div style={{ display: 'grid', gap: '10px' }}>
                            {extras.map((extra) => (
                              <div key={extra.id} style={softItemStyle()}>
                                <div style={{ display: 'grid', gap: '8px' }}>
                                  <select
                                    value={extra.type}
                                    onChange={(e) =>
                                      updateExtra(card.id, extra.id, {
                                        type: e.target.value as ExtraItem['type'],
                                      })
                                    }
                                    style={{ ...inputStyle, maxWidth: '220px' }}
                                  >
                                    <option value="text">텍스트</option>
                                    <option value="image">이미지</option>
                                    <option value="link">링크</option>
                                  </select>

                                  <textarea
                                    value={extra.text}
                                    onChange={(e) =>
                                      updateExtra(card.id, extra.id, { text: e.target.value })
                                    }
                                    placeholder="텍스트 내용"
                                    style={textareaStyle}
                                  />

                                  <input
                                    value={extra.imageUrl}
                                    onChange={(e) =>
                                      updateExtra(card.id, extra.id, { imageUrl: e.target.value })
                                    }
                                    placeholder="이미지 URL"
                                    style={inputStyle}
                                  />

                                  <input
                                    value={extra.linkTitle}
                                    onChange={(e) =>
                                      updateExtra(card.id, extra.id, { linkTitle: e.target.value })
                                    }
                                    placeholder="링크 제목"
                                    style={inputStyle}
                                  />

                                  <input
                                    value={extra.linkUrl}
                                    onChange={(e) =>
                                      updateExtra(card.id, extra.id, { linkUrl: e.target.value })
                                    }
                                    placeholder="링크 URL"
                                    style={inputStyle}
                                  />

                                  <div>
                                    <button
                                      onClick={() => deleteExtra(card.id, extra.id)}
                                      style={dangerButtonStyle}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={boxStyle}>
                        <div style={{ ...sectionTitleStyle, marginBottom: '12px' }}>
                          기존 호환용 필드
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '14px 16px',
                          }}
                        >
                          <div>
                            <div style={labelStyle}>메모</div>
                            <textarea
                              value={card.memoText ?? ''}
                              onChange={(e) => updateCard(card.id, { memoText: e.target.value })}
                              style={textareaStyle}
                            />
                          </div>

                          <div>
                            <div style={labelStyle}>별도/추가 공지</div>
                            <textarea
                              value={card.homeworkText ?? ''}
                              onChange={(e) => updateCard(card.id, { homeworkText: e.target.value })}
                              style={textareaStyle}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );

  function softEmptyStyle(): React.CSSProperties {
    return {
      border: '1px dashed #d1d5db',
      borderRadius: '13px',
      padding: '12px 14px',
      backgroundColor: '#ffffff',
      color: '#6b7280',
      fontSize: '13px',
    };
  }

  function softItemStyle(): React.CSSProperties {
    return {
      border: '1px solid #e5e7eb',
      borderRadius: '13px',
      padding: '12px',
      backgroundColor: '#ffffff',
    };
  }
}