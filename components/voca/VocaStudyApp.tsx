'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getVersionsForCourse,
  getVocaSets,
  loadVocaProgress,
  sampleVocaSet,
  saveVocaProgress,
  VOCA_COURSES,
  VOCA_TRACKS,
} from '@/lib/voca/storage';
import type {
  VocaCourse,
  VocaItem,
  VocaKnowledgeStatus,
  VocaProgressMap,
  VocaSet,
  VocaTrack,
  VocaVersion,
} from '@/lib/voca/types';

type LoggedInStudentLike = {
  classKey?: string;
  classKeys?: string[];
  classGroup?: string;
  course?: string;
  track?: string;
  vocaTrack?: string;
  vocaVersion?: string;
};

type VocaStudyAppProps = {
  student?: LoggedInStudentLike | null;
};

const STATUS_LABEL: Record<VocaKnowledgeStatus, string> = {
  confusing: '헷갈려요',
  unknown: '몰라요',
  known: '알아요',
};

function speak(item: VocaItem) {
  if (typeof window === 'undefined' || !item.speakable || !item.term) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(item.term);
  utterance.lang = 'en-US';
  window.speechSynthesis.speak(utterance);
}

function inferCourse(student?: LoggedInStudentLike | null): VocaCourse | '' {
  const values = [
    student?.course,
    student?.classGroup,
    student?.classKey,
    ...(student?.classKeys ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (values.includes('600')) return '600';
  if (values.includes('800')) return '800';
  return '';
}

function inferTrack(student?: LoggedInStudentLike | null): VocaTrack | '' {
  const values = [student?.vocaTrack, student?.track, student?.classGroup]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (/\bA\b|A진도/.test(values)) return 'A';
  if (/\bB\b|B진도/.test(values)) return 'B';
  return '';
}

function inferVersion(student: LoggedInStudentLike | null | undefined, course: VocaCourse): VocaVersion {
  const value = String(student?.vocaVersion ?? '').trim();
  const versions = getVersionsForCourse(course);
  return versions.includes(value as VocaVersion) ? (value as VocaVersion) : versions[0];
}

export default function VocaStudyApp({ student }: VocaStudyAppProps) {
  const inferredCourse = inferCourse(student);
  const inferredTrack = inferTrack(student);

  const [allSets, setAllSets] = useState<VocaSet[]>([]);
  const [course, setCourse] = useState<VocaCourse>(inferredCourse || '800');
  const [track, setTrack] = useState<VocaTrack>(inferredTrack || 'A');
  const [version, setVersion] = useState<VocaVersion>(
    inferVersion(student, inferredCourse || '800')
  );
  const [selectedSetId, setSelectedSetId] = useState('');
  const [progress, setProgress] = useState<VocaProgressMap>({});
  const [hideMeaning, setHideMeaning] = useState(false);
  const [cardMode, setCardMode] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    window.setTimeout(() => {
      const loadedSets = getVocaSets();
      const nextCourse = inferredCourse || '800';
      const nextTrack = inferredTrack || 'A';
      const nextVersion = inferVersion(student, nextCourse);

      setAllSets(loadedSets);
      setCourse(nextCourse);
      setTrack(nextTrack);
      setVersion(nextVersion);

      const firstMatchingSet = loadedSets.find(
        (set) =>
          set.course === nextCourse &&
          set.track === nextTrack &&
          set.version === nextVersion
      );

      const nextSet = firstMatchingSet ?? sampleVocaSet;
      setSelectedSetId(firstMatchingSet?.id ?? '');
      setProgress(loadVocaProgress(nextSet.id));
    }, 0);
  }, [inferredCourse, inferredTrack, student]);

  const allowedCourses = inferredCourse ? [inferredCourse] : VOCA_COURSES;
  const availableVersions = getVersionsForCourse(course);

  const scopedSets = useMemo(() => {
    return allSets.filter(
      (set) => set.course === course && set.track === track && set.version === version
    );
  }, [allSets, course, track, version]);

  const vocaSet = useMemo(() => {
    return scopedSets.find((set) => set.id === selectedSetId) ?? scopedSets[0] ?? sampleVocaSet;
  }, [scopedSets, selectedSetId]);

  const isSampleMode = scopedSets.length === 0;

  useEffect(() => {
    window.setTimeout(() => {
      setProgress(loadVocaProgress(vocaSet.id));
      setCurrentIndex(0);
    }, 0);
  }, [vocaSet.id]);

  const visibleItems = useMemo(() => {
    const items = reviewOnly
      ? vocaSet.items.filter((item) => {
          const status = progress[item.id];
          return status === 'confusing' || status === 'unknown';
        })
      : vocaSet.items;

    return items.length > 0 ? items : vocaSet.items;
  }, [progress, reviewOnly, vocaSet.items]);

  const currentItem = visibleItems[Math.min(currentIndex, visibleItems.length - 1)];
  const knownCount = vocaSet.items.filter((item) => progress[item.id] === 'known').length;
  const reviewCount = vocaSet.items.filter((item) => {
    const status = progress[item.id];
    return status === 'confusing' || status === 'unknown';
  }).length;

  function chooseCourse(nextCourse: VocaCourse) {
    setCourse(nextCourse);
    const versions = getVersionsForCourse(nextCourse);
    const nextVersion = versions.includes(version) ? version : versions[0];
    setVersion(nextVersion);
    setSelectedSetId('');
    setProgress({});
    setCurrentIndex(0);
  }

  function chooseTrack(nextTrack: VocaTrack) {
    setTrack(nextTrack);
    setSelectedSetId('');
    setProgress({});
    setCurrentIndex(0);
  }

  function chooseVersion(nextVersion: VocaVersion) {
    setVersion(nextVersion);
    setSelectedSetId('');
    setProgress({});
    setCurrentIndex(0);
  }

  function chooseSet(set: VocaSet) {
    setSelectedSetId(set.id);
    setProgress(loadVocaProgress(set.id));
    setCurrentIndex(0);
    setCardMode(false);
    setReviewOnly(false);
  }

  function setStatus(itemId: string, status: VocaKnowledgeStatus) {
    setProgress((prev) => {
      const next = {
        ...prev,
        [itemId]: status,
      };
      saveVocaProgress(vocaSet.id, next);
      return next;
    });
  }

  function moveCard(delta: number) {
    setCurrentIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= visibleItems.length) return visibleItems.length - 1;
      return next;
    });
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#fff8ed',
    fontFamily: 'Arial, sans-serif',
    color: '#111827',
    padding: '18px 12px 42px',
  };

  const shellStyle: React.CSSProperties = {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #eadfce',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: '0 8px 22px rgba(120, 83, 45, 0.08)',
  };

  const bigButtonStyle: React.CSSProperties = {
    minHeight: '48px',
    borderRadius: '14px',
    border: '1px solid #d6d3d1',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    padding: '12px 14px',
  };

  const selectStyle: React.CSSProperties = {
    ...bigButtonStyle,
    width: '100%',
    textAlign: 'left',
  };

  function renderItem(item: VocaItem, compact = false) {
    const status = progress[item.id];
    const statusColor =
      status === 'known' ? '#dcfce7' : status === 'unknown' ? '#fee2e2' : '#fef3c7';

    return (
      <article
        key={item.id}
        style={{
          ...panelStyle,
          display: 'grid',
          gap: '13px',
          backgroundColor: item.type === 'note' ? '#fff7d6' : '#ffffff',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              padding: '6px 10px',
              borderRadius: '999px',
              backgroundColor:
                item.type === 'word'
                  ? '#dbeafe'
                  : item.type === 'phrase'
                  ? '#dcfce7'
                  : item.type === 'note'
                  ? '#fef3c7'
                  : '#f1f5f9',
              fontSize: '12px',
              fontWeight: 900,
            }}
          >
            {item.type === 'word'
              ? 'word'
              : item.type === 'phrase'
              ? 'phrase'
              : item.type === 'note'
              ? 'note'
              : 'misc'}
          </span>
          {status ? (
            <span
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                backgroundColor: statusColor,
                fontSize: '12px',
                fontWeight: 900,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          ) : null}
        </div>

        {item.type === 'word' || item.type === 'phrase' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: item.speakable ? '1fr auto' : '1fr',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: compact ? '26px' : '34px', fontWeight: 900 }}>
                {item.term}
              </div>
              {item.speakable ? (
                <button
                  onClick={() => speak(item)}
                  type="button"
                  aria-label={`${item.term} 발음 듣기`}
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: '#111827',
                    color: '#ffffff',
                    fontSize: '22px',
                    cursor: 'pointer',
                  }}
                >
                  🔊
                </button>
              ) : null}
            </div>

            <div
              style={{
                minHeight: '54px',
                borderRadius: '16px',
                backgroundColor: hideMeaning ? '#f3f4f6' : '#f8fafc',
                color: '#1f2937',
                padding: '14px',
                fontSize: '20px',
                lineHeight: 1.6,
                fontWeight: 900,
              }}
            >
              {hideMeaning ? '뜻 가림' : `${item.pos ? `(${item.pos}) ` : ''}${item.meaning ?? ''}`}
            </div>
          </>
        ) : item.type === 'note' ? (
          <>
            <div style={{ fontSize: '28px', fontWeight: 900 }}>* {item.title}</div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                fontSize: '17px',
                fontWeight: 800,
                color: '#374151',
              }}
            >
              {(item.lines ?? []).join('\n') || item.rawText}
            </div>
          </>
        ) : (
          <div style={{ lineHeight: 1.8, fontSize: '17px', fontWeight: 800 }}>{item.rawText}</div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {(['confusing', 'unknown', 'known'] as VocaKnowledgeStatus[]).map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setStatus(item.id, statusKey)}
              type="button"
              style={{
                ...bigButtonStyle,
                backgroundColor:
                  statusKey === 'known'
                    ? '#dcfce7'
                    : statusKey === 'unknown'
                    ? '#fee2e2'
                    : '#fef3c7',
              }}
            >
              {STATUS_LABEL[statusKey]}
            </button>
          ))}
        </div>
      </article>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={{ ...panelStyle, backgroundColor: '#fffef9' }}>
          <Link
            href="/student"
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              marginBottom: '14px',
              padding: '10px 13px',
              borderRadius: '12px',
              border: '1px solid #e7d8c3',
              backgroundColor: '#ffffff',
              color: '#1f2937',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 900,
            }}
          >
            ← 학생 메인으로
          </Link>
          <div style={{ color: '#92400e', fontSize: '14px', fontWeight: 900, marginBottom: '8px' }}>
            Danny TOEIC Student Page
          </div>
          <h1 style={{ margin: 0, fontSize: '34px', lineHeight: 1.15, fontWeight: 900 }}>
            Danny Voca 단어암기
          </h1>
          <p style={{ margin: '10px 0 0', color: '#57534e', lineHeight: 1.65, fontWeight: 800 }}>
            {vocaSet.displayTitle || vocaSet.title}
          </p>
        </header>

        <section style={{ ...panelStyle, display: 'grid', gap: '12px' }}>
          <div style={{ fontSize: '20px', fontWeight: 900 }}>내 단어 세트 선택</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
            }}
          >
            <select
              value={course}
              onChange={(e) => chooseCourse(e.target.value as VocaCourse)}
              style={selectStyle}
              disabled={Boolean(inferredCourse)}
            >
              {allowedCourses.map((option) => (
                <option key={option} value={option}>
                  {option}반
                </option>
              ))}
            </select>

            <select value={track} onChange={(e) => chooseTrack(e.target.value as VocaTrack)} style={selectStyle}>
              {VOCA_TRACKS.map((option) => (
                <option key={option} value={option}>
                  {option}진도
                </option>
              ))}
            </select>

            <select
              value={version}
              onChange={(e) => chooseVersion(e.target.value as VocaVersion)}
              style={selectStyle}
            >
              {availableVersions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div
              style={{
                ...bigButtonStyle,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#fef3c7',
              }}
            >
              {scopedSets.length > 0 ? `${scopedSets.length}개 Day` : '업로드 없음'}
            </div>
          </div>

          {scopedSets.length > 0 ? (
            <div style={{ display: 'grid', gap: '8px' }}>
              {scopedSets.map((set) => (
                <button
                  key={set.id}
                  onClick={() => chooseSet(set)}
                  type="button"
                  style={{
                    ...bigButtonStyle,
                    textAlign: 'left',
                    backgroundColor: vocaSet.id === set.id ? '#dbeafe' : '#ffffff',
                  }}
                >
                  {set.displayTitle || set.title}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#78716c', fontWeight: 900, lineHeight: 1.6 }}>
              선택한 반/진도/버전으로 업로드된 세트가 없어 샘플 세트를 표시합니다.
            </div>
          )}

          {isSampleMode ? null : (
            <div style={{ color: '#78716c', fontSize: '13px', fontWeight: 900 }}>
              현재 선택: {vocaSet.displayTitle || vocaSet.title}
            </div>
          )}
        </section>

        <section
          style={{
            ...panelStyle,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{vocaSet.items.length}</div>
            <div style={{ color: '#78716c', fontSize: '12px', fontWeight: 900 }}>전체</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{knownCount}</div>
            <div style={{ color: '#78716c', fontSize: '12px', fontWeight: 900 }}>알아요</div>
          </div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900 }}>{reviewCount}</div>
            <div style={{ color: '#78716c', fontSize: '12px', fontWeight: 900 }}>복습</div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
          }}
        >
          <button
            onClick={() => setHideMeaning((prev) => !prev)}
            type="button"
            style={{ ...bigButtonStyle, backgroundColor: hideMeaning ? '#dbeafe' : '#ffffff' }}
          >
            뜻 가리고 보기
          </button>
          <button
            onClick={() => {
              setCardMode((prev) => !prev);
              setCurrentIndex(0);
            }}
            type="button"
            style={{ ...bigButtonStyle, backgroundColor: cardMode ? '#dbeafe' : '#ffffff' }}
          >
            카드 넘기기
          </button>
          <button
            onClick={() => {
              setReviewOnly((prev) => !prev);
              setCurrentIndex(0);
            }}
            type="button"
            style={{ ...bigButtonStyle, backgroundColor: reviewOnly ? '#fef3c7' : '#ffffff' }}
          >
            헷갈린 것만
          </button>
          <button
            onClick={() => {
              setHideMeaning(false);
              setCardMode(false);
              setReviewOnly(false);
              setCurrentIndex(0);
            }}
            type="button"
            style={bigButtonStyle}
          >
            전체 보기
          </button>
        </section>

        {cardMode && currentItem ? (
          <section style={{ display: 'grid', gap: '12px' }}>
            {renderItem(currentItem)}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              <button onClick={() => moveCard(-1)} type="button" style={bigButtonStyle}>
                이전
              </button>
              <button onClick={() => moveCard(1)} type="button" style={bigButtonStyle}>
                다음
              </button>
            </div>
            <div style={{ textAlign: 'center', color: '#78716c', fontWeight: 900 }}>
              {Math.min(currentIndex + 1, visibleItems.length)} / {visibleItems.length}
            </div>
          </section>
        ) : (
          <section style={{ display: 'grid', gap: '14px' }}>
            {visibleItems.map((item) => renderItem(item, true))}
          </section>
        )}
      </div>
    </main>
  );
}
