'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TodayHomeworkCard, TodayHomeworkSet, TodayHomeworkTrack } from '../../../lib/today-homework';

type LoggedInStudent = {
  id: string;
  name: string;
  classKey?: string;
  classKeys?: string[];
  monthKey?: string;
  month_key?: string;
};

function hasAccess(student: LoggedInStudent, classKey: string) {
  return student.classKey === classKey || student.classKeys?.includes(classKey) === true;
}

function trackFor(classKey: string, monthKey: string): TodayHomeworkTrack {
  const month = Number(monthKey.split('-')[1]) || new Date().getMonth() + 1;
  const oddMonth = month % 2 === 1;
  if (classKey === '600-monwed') return oddMonth ? 'A' : 'B';
  return oddMonth ? 'B' : 'A';
}

function speak(text?: string) {
  if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

const primaryButton: React.CSSProperties = {
  border: 0, borderRadius: '14px', padding: '14px 20px', backgroundColor: '#f97316',
  color: '#fff', fontWeight: 900, fontSize: '17px', cursor: 'pointer',
};

export default function TodayHomeworkPage() {
  const router = useRouter();
  const [student, setStudent] = useState<LoggedInStudent | null>(null);
  const [classKey, setClassKey] = useState('');
  const [track, setTrack] = useState<TodayHomeworkTrack>('A');
  const [sets, setSets] = useState<TodayHomeworkSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<TodayHomeworkSet | null>(null);
  const [activeCards, setActiveCards] = useState<TodayHomeworkCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCards, setWrongCards] = useState<TodayHomeworkCard[]>([]);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [isRetry, setIsRetry] = useState(false);
  const [message, setMessage] = useState('오늘홈트를 불러오는 중...');

  useEffect(() => {
    const saved = localStorage.getItem('loggedInStudent');
    if (!saved) { router.push('/'); return; }
    try {
      const parsed = JSON.parse(saved) as LoggedInStudent;
      const requestedClass = new URLSearchParams(window.location.search).get('classKey') || parsed.classKey || '';
      if (!requestedClass.startsWith('600-') || !hasAccess(parsed, requestedClass)) { router.push('/student'); return; }
      const mappedTrack = trackFor(requestedClass, parsed.monthKey || parsed.month_key || '');
      window.setTimeout(() => {
        setStudent(parsed);
        setClassKey(requestedClass);
        setTrack(mappedTrack);
      }, 0);
      fetch(`/api/today-homework?track=${mappedTrack}`, { cache: 'no-store' })
        .then((response) => response.json())
        .then((result) => {
          if (result.success) {
            setSets(Array.isArray(result.sets) ? result.sets : []);
            setMessage(result.sets?.length ? '' : '등록된 오늘홈트가 없습니다.');
          } else setMessage(result.message ?? '오늘홈트를 불러오지 못했습니다.');
        })
        .catch(() => setMessage('오늘홈트를 불러오는 중 오류가 발생했습니다.'));
    } catch { localStorage.removeItem('loggedInStudent'); router.push('/'); }
  }, [router]);

  const currentCard = activeCards[index];
  const classPageHref = classKey ? `/student/class-${classKey}` : '/student';
  const totalCount = selectedSet?.cards.length ?? 0;
  const finalWrongCount = wrongCards.length;

  const sortedSets = useMemo(() => [...sets].sort((a, b) => a.dayNumber - b.dayNumber), [sets]);

  function chooseSet(set: TodayHomeworkSet) {
    setSelectedSet(set); setActiveCards(set.cards); setIndex(0); setRevealed(false);
    setCorrectCount(0); setWrongCards([]); setStarted(false); setCompleted(false); setIsRetry(false);
  }

  function startTraining() {
    if (!selectedSet) return;
    setActiveCards(selectedSet.cards); setIndex(0); setRevealed(false); setCorrectCount(0);
    setWrongCards([]); setStarted(true); setCompleted(false); setIsRetry(false);
  }

  async function finishTraining(nextCorrect: number, nextWrong: TodayHomeworkCard[]) {
    setCorrectCount(nextCorrect); setWrongCards(nextWrong); setCompleted(true); setStarted(false);
    if (!student || !selectedSet || isRetry) return;
    fetch('/api/today-homework', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save-progress', studentId: student.id, setId: selectedSet.id, correctCount: nextCorrect, wrongCount: nextWrong.length, wrongCardIds: nextWrong.map((card) => card.id) }),
    }).catch((error) => console.error('today homework progress error:', error));
  }

  function answer(correct: boolean) {
    if (!currentCard) return;
    const nextCorrect = correct ? correctCount + 1 : correctCount;
    const nextWrong = correct ? wrongCards : [...wrongCards.filter((card) => card.id !== currentCard.id), currentCard];
    if (index >= activeCards.length - 1) { finishTraining(nextCorrect, nextWrong); return; }
    setCorrectCount(nextCorrect); setWrongCards(nextWrong); setIndex((value) => value + 1); setRevealed(false);
  }

  function retryWrong() {
    if (!wrongCards.length) return;
    setActiveCards(wrongCards); setIndex(0); setRevealed(false); setCorrectCount(0);
    setWrongCards([]); setStarted(true); setCompleted(false); setIsRetry(true);
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #fff7ed, #ffedd5)', color: '#1c1917', padding: '24px 14px 50px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '760px', margin: '0 auto' }}>
        <Link href={classPageHref} style={{ color: '#9a3412', fontWeight: 800, textDecoration: 'none' }}>← 반별 수업자료로</Link>

        {!selectedSet ? (
          <section style={{ marginTop: '22px' }}>
            <div style={{ marginBottom: '20px' }}><div style={{ fontSize: '14px', color: '#c2410c', fontWeight: 900 }}>600 {track} 자동 연결</div><h1 style={{ margin: '6px 0', fontSize: '42px' }}>🏋️ 오늘홈트</h1><p style={{ color: '#78716c', lineHeight: 1.7 }}>수업 후 5~10분, 머릿속으로 답하고 스스로 체크하세요.</p></div>
            {message ? <div style={{ padding: '20px', borderRadius: '16px', backgroundColor: 'white', color: '#78716c' }}>{message}</div> : null}
            <div style={{ display: 'grid', gap: '12px' }}>{sortedSets.map((set) => <button key={set.id} onClick={() => chooseSet(set)} style={{ border: '1px solid #fed7aa', borderRadius: '16px', padding: '18px', backgroundColor: 'white', textAlign: 'left', cursor: 'pointer', boxShadow: '0 8px 22px rgba(124,45,18,.08)' }}><strong style={{ fontSize: '20px' }}>Day{set.dayNumber}</strong><div style={{ marginTop: '6px', color: '#78716c' }}>{set.title} · {set.cards.length}문제</div></button>)}</div>
          </section>
        ) : !started && !completed ? (
          <section style={{ marginTop: '60px', backgroundColor: 'white', borderRadius: '24px', padding: '34px', textAlign: 'center', boxShadow: '0 18px 50px rgba(124,45,18,.12)' }}>
            <div style={{ fontSize: '42px' }}>🏋️</div><h1 style={{ fontSize: '38px', margin: '12px 0 8px' }}>오늘홈트</h1><h2 style={{ color: '#c2410c' }}>{track} Day{selectedSet.dayNumber}</h2><p style={{ color: '#78716c' }}>{selectedSet.title}</p><p style={{ fontWeight: 800 }}>예상시간 5~10분 · {selectedSet.cards.length}문제</p>
            <button onClick={startTraining} style={{ ...primaryButton, marginTop: '16px', width: '100%' }}>시작하기</button>
          </section>
        ) : completed ? (
          <section style={{ marginTop: '50px', backgroundColor: 'white', borderRadius: '24px', padding: '34px', textAlign: 'center', boxShadow: '0 18px 50px rgba(124,45,18,.12)' }}>
            <div style={{ fontSize: '52px' }}>🎉</div><h1>오늘홈트 완료</h1><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '24px 0' }}><div><strong style={{ fontSize: '26px' }}>{isRetry ? activeCards.length : totalCount}</strong><div>전체</div></div><div><strong style={{ fontSize: '26px', color: '#15803d' }}>{correctCount}</strong><div>맞음</div></div><div><strong style={{ fontSize: '26px', color: '#dc2626' }}>{finalWrongCount}</strong><div>틀림</div></div></div>
            {wrongCards.length ? <button onClick={retryWrong} style={{ ...primaryButton, width: '100%' }}>틀린 문제 다시하기</button> : <div style={{ color: '#15803d', fontWeight: 900 }}>모두 맞았어요! 오늘 운동 끝 💪</div>}
            <button onClick={() => setSelectedSet(null)} style={{ marginTop: '12px', width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid #fed7aa', backgroundColor: 'white', fontWeight: 800 }}>Day 목록으로</button>
          </section>
        ) : currentCard ? (
          <section style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: '#9a3412', marginBottom: '9px' }}><span>{isRetry ? '오답 다시하기' : `${track} Day${selectedSet.dayNumber}`}</span><span>{index + 1} / {activeCards.length}</span></div>
            <div style={{ height: '8px', backgroundColor: '#fed7aa', borderRadius: '999px', overflow: 'hidden', marginBottom: '16px' }}><div style={{ width: `${((index + 1) / activeCards.length) * 100}%`, height: '100%', backgroundColor: '#f97316' }} /></div>
            <article style={{ backgroundColor: 'white', borderRadius: '24px', padding: '30px 24px', minHeight: '390px', boxShadow: '0 18px 50px rgba(124,45,18,.12)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#c2410c', fontWeight: 800, fontSize: '13px' }}>{currentCard.type}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}><h1 style={{ margin: 0, fontSize: '34px', whiteSpace: 'pre-wrap' }}>{currentCard.prompt}</h1>{currentCard.speakText ? <button onClick={() => speak(currentCard.speakText)} aria-label={`${currentCard.speakText} 발음 듣기`} style={{ border: 0, borderRadius: '999px', backgroundColor: '#ffedd5', fontSize: '22px', padding: '8px', cursor: 'pointer' }}>🔊</button> : null}</div>
              {currentCard.question ? <p style={{ fontSize: '20px', color: '#57534e', fontWeight: 700 }}>{currentCard.question}</p> : null}
              <div style={{ flex: 1 }} />
              {!revealed ? <button onClick={() => setRevealed(true)} style={{ ...primaryButton, width: '100%' }}>정답 보기</button> : <div><div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '16px', padding: '18px', marginBottom: '14px' }}><div style={{ color: '#9a3412', fontWeight: 800, marginBottom: '7px' }}>정답</div><div style={{ fontSize: '23px', fontWeight: 900, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{currentCard.answer}</div>{currentCard.note ? <div style={{ marginTop: '10px', color: '#78716c', whiteSpace: 'pre-wrap' }}>{currentCard.note}</div> : null}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}><button onClick={() => answer(true)} style={{ ...primaryButton, backgroundColor: '#15803d' }}>맞았어요</button><button onClick={() => answer(false)} style={{ ...primaryButton, backgroundColor: '#dc2626' }}>틀렸어요</button></div></div>}
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}
