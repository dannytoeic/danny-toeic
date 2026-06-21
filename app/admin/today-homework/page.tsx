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
  rule: '규칙 암기형',
  'method-order': '풀이순서형',
  condition: '조건 판단형',
  general: '일반 암기형',
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

function emptyCard(): TodayHomeworkCard {
  return {
    id: `today-homework-card-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'general',
    prompt: '',
    question: '',
    answer: '',
    note: '',
    speakText: '',
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
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [previewRevealed, setPreviewRevealed] = useState(false);

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
    setPreviewCardId(null);
    setPreviewRevealed(false);
  }, [selectedSavedSet, track, dayNumber]);

  function updateCard(id: string, patch: Partial<TodayHomeworkCard>) {
    setDraft((current) => ({ ...current, cards: current.cards.map((card) => card.id === id ? { ...card, ...patch } : card) }));
  }

  function generateCards() {
    const cards = parseTodayHomeworkText(draft.rawText);
    const manualCards = draft.cards.filter((card) => card.id.startsWith('today-homework-card-manual-'));
    setDraft((current) => ({ ...current, cards: [...cards, ...manualCards] }));
    setMessage(cards.length ? `${cards.length}개의 자동 카드 후보를 만들었습니다.${manualCards.length ? ` 직접 추가한 ${manualCards.length}개 카드는 목록 뒤에 유지했습니다.` : ''} 수정·삭제 후 저장해야 학생에게 보입니다.` : '감지된 자동 카드 후보가 없습니다. 직접 추가한 카드는 유지했습니다. 원문의 줄바꿈과 형식을 확인해 주세요.');
  }

  function addCard() {
    setDraft((current) => ({ ...current, cards: [...current.cards, emptyCard()] }));
    setMessage('새 카드를 목록 마지막에 추가했습니다. 내용을 입력한 뒤 저장해 주세요.');
  }

  function moveCard(fromIndex: number, toIndex: number) {
    setDraft((current) => {
      if (toIndex < 0 || toIndex >= current.cards.length || fromIndex === toIndex) return current;
      const cards = [...current.cards];
      const [card] = cards.splice(fromIndex, 1);
      cards.splice(toIndex, 0, card);
      return { ...current, cards };
    });
  }

  function moveCardToPosition(fromIndex: number, value: number) {
    const toIndex = Math.min(draft.cards.length, Math.max(1, value)) - 1;
    moveCard(fromIndex, toIndex);
  }

  async function saveSet() {
    const incompleteIndex = draft.cards.findIndex((card) => !card.prompt.trim() || !card.answer.trim());
    if (incompleteIndex >= 0) {
      setMessage(`문제 ${incompleteIndex + 1}의 문제와 정답을 모두 입력해 주세요.`);
      return;
    }
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
            <button type="button" onClick={generateCards} style={buttonStyle}>카드 후보 생성</button>
            <button type="button" onClick={addCard} style={{ ...buttonStyle, backgroundColor: '#7c3aed' }}>+ 카드 직접 추가</button>
            <button type="button" onClick={saveSet} disabled={isSaving || draft.cards.length === 0} style={{ ...buttonStyle, backgroundColor: '#0f766e', opacity: isSaving || draft.cards.length === 0 ? 0.5 : 1 }}>{isSaving ? '저장 중...' : '검수 완료 후 저장'}</button>
            {selectedSavedSet ? <button type="button" onClick={deleteSet} style={{ ...buttonStyle, backgroundColor: '#be123c' }}>삭제</button> : null}
          </div>
          {message ? <div style={{ color: message.includes('실패') || message.includes('없습니다') ? '#b91c1c' : '#0f766e', fontWeight: 700 }}>{message}</div> : null}
        </section>

        {draft.cards.length ? (
          <section style={{ display: 'grid', gap: '14px' }}>
            <div style={{ padding: '14px 16px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontWeight: 800 }}>아래 내용은 카드 후보입니다. 저장 버튼을 누르기 전에는 학생에게 노출되지 않습니다.</div>
            <h2 style={{ margin: 0 }}>카드 후보 검수 · {draft.cards.length}문제</h2>
            {draft.cards.map((card, index) => (
              <article key={card.id} style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>문제 {index + 1}</strong>
                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => moveCard(index, index - 1)} disabled={index === 0} style={{ ...buttonStyle, padding: '7px 10px', backgroundColor: '#475569', opacity: index === 0 ? 0.4 : 1 }}>↑ 위로</button>
                    <button type="button" onClick={() => moveCard(index, index + 1)} disabled={index === draft.cards.length - 1} style={{ ...buttonStyle, padding: '7px 10px', backgroundColor: '#475569', opacity: index === draft.cards.length - 1 ? 0.4 : 1 }}>↓ 아래로</button>
                    <button type="button" onClick={() => { setPreviewCardId(card.id); setPreviewRevealed(false); }} style={{ ...buttonStyle, padding: '7px 10px', backgroundColor: '#c2410c' }}>미리보기</button>
                    <button type="button" onClick={() => { setDraft((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) })); if (previewCardId === card.id) setPreviewCardId(null); }} style={{ border: 0, background: '#fff1f2', color: '#be123c', borderRadius: '8px', padding: '7px 10px', fontWeight: 700 }}>삭제</button>
                  </div>
                </div>
                <label><strong>카드 유형</strong><select value={card.type} onChange={(event) => updateCard(card.id, { type: event.target.value as TodayHomeworkCardType })} style={{ ...fieldStyle, marginTop: '6px' }}>{Object.entries(CARD_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><strong>문제</strong><input value={card.prompt} onChange={(event) => updateCard(card.id, { prompt: event.target.value })} placeholder="예: have pp" style={{ ...fieldStyle, marginTop: '6px' }} /></label>
                <label><strong>질문</strong><input value={card.question} onChange={(event) => updateCard(card.id, { question: event.target.value })} placeholder="예: 사이에는 어떤 품사가 들어가는가?" style={{ ...fieldStyle, marginTop: '6px' }} /></label>
                <label><strong>정답</strong><textarea value={card.answer} onChange={(event) => updateCard(card.id, { answer: event.target.value })} placeholder="예: 부사" style={{ ...fieldStyle, marginTop: '6px', minHeight: '80px', whiteSpace: 'pre-wrap' }} /></label>
                <label><strong>보충설명</strong><textarea value={card.note} onChange={(event) => updateCard(card.id, { note: event.target.value })} placeholder="예: have pp 사이는 백퍼 부사자리" style={{ ...fieldStyle, marginTop: '6px', minHeight: '70px' }} /></label>
                <label><strong>발음 대상 단어 <span style={{ color: '#64748b', fontWeight: 500 }}>(선택)</span></strong><input value={card.speakText ?? ''} onChange={(event) => updateCard(card.id, { speakText: event.target.value })} placeholder="예: participate" style={{ ...fieldStyle, marginTop: '6px' }} /></label>
                <label><strong>표시 순서</strong><input type="number" min={1} max={draft.cards.length} value={index + 1} onChange={(event) => moveCardToPosition(index, Number(event.target.value) || 1)} style={{ ...fieldStyle, marginTop: '6px' }} /></label>
              </article>
            ))}
            <button type="button" onClick={addCard} style={{ ...buttonStyle, backgroundColor: '#7c3aed', justifySelf: 'start' }}>+ 카드 직접 추가</button>
          </section>
        ) : <button type="button" onClick={addCard} style={{ ...buttonStyle, backgroundColor: '#7c3aed', justifySelf: 'start' }}>+ 카드 직접 추가</button>}

        {previewCardId && draft.cards.some((card) => card.id === previewCardId) ? (() => {
          const previewCard = draft.cards.find((card) => card.id === previewCardId)!;
          return (
            <section style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '20px', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}><h2 style={{ margin: 0 }}>학생 화면 미리보기</h2><button type="button" onClick={() => setPreviewCardId(null)} style={{ border: 0, background: 'transparent', fontSize: '22px', cursor: 'pointer' }} aria-label="미리보기 닫기">×</button></div>
              <article style={{ maxWidth: '620px', margin: '18px auto 0', backgroundColor: 'white', borderRadius: '24px', padding: '30px 24px', minHeight: '330px', boxShadow: '0 18px 50px rgba(124,45,18,.12)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ color: '#c2410c', fontWeight: 800, fontSize: '13px' }}>{CARD_TYPE_LABELS[previewCard.type]}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}><h1 style={{ margin: 0, fontSize: '34px', whiteSpace: 'pre-wrap' }}>{previewCard.prompt || '문제를 입력하세요.'}</h1>{previewCard.speakText?.trim() ? <span aria-label="발음 버튼 미리보기" style={{ borderRadius: '999px', backgroundColor: '#ffedd5', fontSize: '22px', padding: '8px' }}>🔊</span> : null}</div>
                {previewCard.question ? <p style={{ fontSize: '20px', color: '#57534e', fontWeight: 700 }}>{previewCard.question}</p> : null}
                <div style={{ flex: 1 }} />
                {!previewRevealed ? <button type="button" onClick={() => setPreviewRevealed(true)} style={{ ...buttonStyle, width: '100%', backgroundColor: '#f97316' }}>정답 보기</button> : <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '16px', padding: '18px' }}><div style={{ color: '#9a3412', fontWeight: 800, marginBottom: '7px' }}>정답</div><div style={{ fontSize: '23px', fontWeight: 900, whiteSpace: 'pre-wrap' }}>{previewCard.answer || '정답을 입력하세요.'}</div>{previewCard.note ? <div style={{ marginTop: '10px', color: '#78716c', whiteSpace: 'pre-wrap' }}>{previewCard.note}</div> : null}</div>}
              </article>
            </section>
          );
        })() : null}
      </div>
    </AdminShell>
  );
}
