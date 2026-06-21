'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from '../AdminShell';
import { getLoggedInAdmin } from '../adminGuard';
import {
  makeTodayHomeworkSetId,
  parseTodayHomeworkText,
  TodayHomeworkCard,
  TodayHomeworkCardType,
  TodayHomeworkSet,
  TodayHomeworkTrack,
} from '../../../lib/today-homework';

const CARD_TYPE_LABELS: Record<TodayHomeworkCardType, string> = {
  preposition: '전치사 암기형',
  meaning: '의미 암기형',
  'part-of-speech': '품사 판별형',
  method: '풀이방법형',
  condition: '조건 판단형',
  general: '일반형',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: '10px',
  backgroundColor: 'white', color: '#111827', fontSize: '15px', boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '11px 16px', border: 0, borderRadius: '10px', backgroundColor: '#111827',
  color: 'white', fontWeight: 800, cursor: 'pointer',
};

function emptySet(track: TodayHomeworkTrack, dayNumber: number): TodayHomeworkSet {
  return {
    id: makeTodayHomeworkSetId(track, dayNumber), level: '600', track, dayNumber,
    title: `${track} Day${dayNumber}`, rawText: '', cards: [], isActive: true,
  };
}

export default function TodayHomeworkAdminPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [sets, setSets] = useState<TodayHomeworkSet[]>([]);
  const [track, setTrack] = useState<TodayHomeworkTrack>('A');
  const [dayNumber, setDayNumber] = useState(1);
  const [draft, setDraft] = useState<TodayHomeworkSet>(() => emptySet('A', 1));
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!getLoggedInAdmin()) { router.push('/admin/login'); return; }
    setIsChecking(false);
  }, [router]);

  async function loadSets() {
    try {
      const response = await fetch('/api/today-homework?admin=1', { cache: 'no-store' });
      const result = await response.json();
      if (result.success) setSets(Array.isArray(result.sets) ? result.sets : []);
    } catch (error) {
      console.error(error); setMessage('저장된 오늘홈트를 불러오지 못했습니다.');
    }
  }

  useEffect(() => { if (!isChecking) loadSets(); }, [isChecking]);

  const selectedSavedSet = useMemo(
    () => sets.find((set) => set.track === track && set.dayNumber === dayNumber),
    [sets, track, dayNumber]
  );

  useEffect(() => {
    setDraft(selectedSavedSet ? { ...selectedSavedSet, cards: selectedSavedSet.cards.map((card) => ({ ...card })) } : emptySet(track, dayNumber));
    setMessage('');
  }, [selectedSavedSet, track, dayNumber]);

  function updateCard(id: string, patch: Partial<TodayHomeworkCard>) {
    setDraft((current) => ({ ...current, cards: current.cards.map((card) => card.id === id ? { ...card, ...patch } : card) }));
  }

  function generateCards() {
    const cards = parseTodayHomeworkText(draft.rawText);
    setDraft((current) => ({ ...current, cards }));
    setMessage(cards.length ? `${cards.length}개의 카드를 생성했습니다. 내용을 확인하고 저장해 주세요.` : '자동 감지된 카드가 없습니다. 원문의 줄바꿈과 형식을 확인해 주세요.');
  }

  async function saveSet() {
    setIsSaving(true); setMessage('');
    try {
      const response = await fetch('/api/today-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-set', set: draft }) });
      const result = await response.json();
      if (!result.success) { setMessage(result.message ?? '저장에 실패했습니다.'); return; }
      setMessage('오늘홈트 세트가 저장되었습니다.');
      await loadSets();
    } catch (error) { console.error(error); setMessage('저장 중 오류가 발생했습니다.'); }
    finally { setIsSaving(false); }
  }

  async function deleteSet() {
    if (!selectedSavedSet || !window.confirm(`${track} Day${dayNumber} 세트를 삭제할까요?`)) return;
    const response = await fetch('/api/today-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete-set', track, dayNumber }) });
    const result = await response.json();
    if (result.success) { setMessage('세트가 삭제되었습니다.'); await loadSets(); }
    else setMessage(result.message ?? '삭제에 실패했습니다.');
  }

  if (isChecking) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>관리자 상태 확인 중...</main>;

  return (
    <AdminShell title="🏋️ 오늘홈트 관리" description="600반 암기장 원문을 붙여넣고 A/B별 Daily 셀프 체크 카드를 만듭니다.">
      <div style={{ display: 'grid', gap: '20px' }}>
        <section style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '22px', display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <label><strong>과정</strong><input value="600" disabled style={{ ...fieldStyle, marginTop: '7px', backgroundColor: '#f8fafc' }} /></label>
            <label><strong>A/B</strong><select value={track} onChange={(event) => setTrack(event.target.value as TodayHomeworkTrack)} style={{ ...fieldStyle, marginTop: '7px' }}><option value="A">A</option><option value="B">B</option></select></label>
            <label><strong>Day</strong><input type="number" min={1} max={100} value={dayNumber} onChange={(event) => setDayNumber(Math.max(1, Number(event.target.value) || 1))} style={{ ...fieldStyle, marginTop: '7px' }} /></label>
          </div>
          <label><strong>제목</strong><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} style={{ ...fieldStyle, marginTop: '7px' }} /></label>
          <label><strong>docx 내용 붙여넣기</strong><textarea value={draft.rawText} onChange={(event) => setDraft((current) => ({ ...current, rawText: event.target.value }))} placeholder="Word 문서의 내용을 그대로 복사해서 붙여넣으세요." style={{ ...fieldStyle, marginTop: '7px', minHeight: '300px', resize: 'vertical', lineHeight: 1.7, whiteSpace: 'pre-wrap' }} /></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />학생에게 표시</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={generateCards} style={buttonStyle}>자동 카드 생성</button>
            <button type="button" onClick={saveSet} disabled={isSaving || draft.cards.length === 0} style={{ ...buttonStyle, backgroundColor: '#0f766e', opacity: isSaving || draft.cards.length === 0 ? 0.5 : 1 }}>{isSaving ? '저장 중...' : '저장'}</button>
            {selectedSavedSet ? <button type="button" onClick={deleteSet} style={{ ...buttonStyle, backgroundColor: '#be123c' }}>삭제</button> : null}
          </div>
          {message ? <div style={{ color: message.includes('실패') || message.includes('없습니다') ? '#b91c1c' : '#0f766e', fontWeight: 700 }}>{message}</div> : null}
        </section>

        {draft.cards.length ? (
          <section style={{ display: 'grid', gap: '14px' }}>
            <h2 style={{ margin: 0 }}>생성 카드 미리보기 · {draft.cards.length}문제</h2>
            {draft.cards.map((card, index) => (
              <article key={card.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><strong>문제 {index + 1}</strong><button type="button" onClick={() => setDraft((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) }))} style={{ border: 0, background: '#fff1f2', color: '#be123c', borderRadius: '8px', padding: '7px 10px', fontWeight: 700 }}>삭제</button></div>
                <select value={card.type} onChange={(event) => updateCard(card.id, { type: event.target.value as TodayHomeworkCardType })} style={fieldStyle}>{Object.entries(CARD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <input value={card.prompt} onChange={(event) => updateCard(card.id, { prompt: event.target.value })} placeholder="문제" style={fieldStyle} />
                <input value={card.question} onChange={(event) => updateCard(card.id, { question: event.target.value })} placeholder="질문" style={fieldStyle} />
                <textarea value={card.answer} onChange={(event) => updateCard(card.id, { answer: event.target.value })} placeholder="정답" style={{ ...fieldStyle, minHeight: '80px', whiteSpace: 'pre-wrap' }} />
                <textarea value={card.note} onChange={(event) => updateCard(card.id, { note: event.target.value })} placeholder="보충설명" style={{ ...fieldStyle, minHeight: '70px' }} />
                <input value={card.speakText ?? ''} onChange={(event) => updateCard(card.id, { speakText: event.target.value })} placeholder="발음할 영어 단어(선택)" style={fieldStyle} />
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}

