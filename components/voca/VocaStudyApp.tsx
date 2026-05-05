'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getVersionsForCourse,
  fetchRemoteVocaSets,
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
  VocaItemType,
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
  confusing: '헷갈림',
  unknown: '몰라요',
  known: '알아요',
};

const STATUS_STYLE: Record<
  VocaKnowledgeStatus,
  {
    backgroundColor: string;
    borderColor: string;
    color: string;
    iconBackgroundColor: string;
    iconBorderColor: string;
    iconColor: string;
  }
> = {
  confusing: {
    backgroundColor: '#F4E1BC',
    borderColor: '#DBA54F',
    color: '#8A5A12',
    iconBackgroundColor: 'transparent',
    iconBorderColor: '#8A5A12',
    iconColor: '#8A5A12',
  },
  unknown: {
    backgroundColor: '#F6B0A4',
    borderColor: '#F06F62',
    color: '#8D2018',
    iconBackgroundColor: '#F45145',
    iconBorderColor: '#F45145',
    iconColor: '#FFFFFF',
  },
  known: {
    backgroundColor: '#B9E3EA',
    borderColor: '#55B6C4',
    color: '#075C70',
    iconBackgroundColor: '#087F95',
    iconBorderColor: '#087F95',
    iconColor: '#FFFFFF',
  },
};

const STATUS_ICON: Record<VocaKnowledgeStatus, string> = {
  confusing: '?',
  unknown: 'X',
  known: '✓',
};

const TYPE_LABEL: Record<VocaItemType, string> = {
  word: 'word',
  phrase: 'phrase',
  note: 'note',
  misc: 'misc',
  blank: 'blank',
  grammar: 'grammar',
  pattern: 'pattern',
  group: 'group',
};

const TYPE_COLOR: Record<VocaItemType, string> = {
  word: '#E4EDF7',
  phrase: '#E4EDF7',
  note: '#E4EDF7',
  misc: '#E4EDF7',
  blank: '#E4EDF7',
  grammar: '#E4EDF7',
  pattern: '#E4EDF7',
  group: '#E4EDF7',
};

function getSpeakText(item: VocaItem) {
  if (item.term) return item.term;
  if (item.speakable && item.prompt) {
    return item.prompt.replace(/____/g, '').replace(/[:：]/g, '').trim();
  }
  return '';
}

function speak(item: VocaItem) {
  const text = getSpeakText(item);
  if (typeof window === 'undefined' || !item.speakable || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
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
  const values = [
    student?.vocaTrack,
    student?.track,
    student?.classGroup,
    student?.classKey,
    ...(student?.classKeys ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (/\bA\b|A진도|A반/.test(values)) return 'A';
  if (/\bB\b|B진도|B반/.test(values)) return 'B';

  const classKeys = [student?.classKey, ...(student?.classKeys ?? [])]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const hasMonWed = classKeys.some((value) => value.includes('monwed'));
  const hasTuThu = classKeys.some((value) => value.includes('tuthu'));

  if (hasMonWed && !hasTuThu) return 'A';
  if (hasTuThu && !hasMonWed) return 'B';

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
      async function loadSets() {
        const nextCourse = inferredCourse || '800';
        const nextTrack = inferredTrack || 'A';
        const nextVersion = inferVersion(student, nextCourse);
        let loadedSets: VocaSet[] = [];

        try {
          loadedSets = await fetchRemoteVocaSets();
        } catch (error) {
          console.error(error);
          loadedSets = getVocaSets();
        }

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
      }

      loadSets();
    }, 0);
  }, [inferredCourse, inferredTrack, student]);

  const allowedCourses = inferredCourse ? [inferredCourse] : VOCA_COURSES;
  const allowedTracks = inferredTrack ? [inferredTrack] : VOCA_TRACKS;
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
    backgroundColor: '#050C18',
    fontFamily: 'Arial, sans-serif',
    color: '#F4F4F2',
    padding: '18px 12px 42px',
  };

  const shellStyle: React.CSSProperties = {
    maxWidth: '760px',
    margin: '0 auto',
    display: 'grid',
    gap: '16px',
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#101C2E',
    border: '1px solid #283447',
    borderRadius: '28px',
    padding: '20px',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.28)',
  };

  const itemCardStyle: React.CSSProperties = {
    backgroundColor: '#FAFAF8',
    border: '1px solid #D7DEE7',
    borderRadius: '28px',
    padding: '20px',
    boxShadow: '0 10px 30px rgba(4, 10, 20, 0.10)',
  };

  const bigButtonStyle: React.CSSProperties = {
    minHeight: '48px',
    borderRadius: '22px',
    border: '1.5px solid #5E7EAB',
    backgroundColor: '#F4F5F7',
    color: '#35527B',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    padding: '12px 14px',
    boxShadow: '0 8px 18px rgba(4, 10, 20, 0.12)',
    maxWidth: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...bigButtonStyle,
    width: '100%',
    textAlign: 'left',
  };

  const speakerButtonStyle: React.CSSProperties = {
    width: '50px',
    height: '50px',
    borderRadius: '999px',
    border: 'none',
    backgroundColor: '#5D82B4',
    color: '#FFFFFF',
    fontSize: '22px',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(38, 70, 120, 0.20)',
  };

  const meaningBoxStyle: React.CSSProperties = {
    minHeight: '54px',
    borderRadius: '18px',
    backgroundColor: '#EEF3F8',
    border: '1px solid #D9E3EE',
    color: '#07162F',
    padding: '15px',
    fontSize: '20px',
    lineHeight: 1.6,
    fontWeight: 900,
  };

  function modeButtonStyle(active: boolean): React.CSSProperties {
    return {
      ...bigButtonStyle,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: '50px',
      backgroundColor: active ? '#5C84B8' : '#F4F5F7',
      borderColor: active ? '#5C84B8' : '#5E7EAB',
      color: active ? '#FFFFFF' : '#2E4B70',
      whiteSpace: 'nowrap',
      boxShadow: active
        ? '0 10px 22px rgba(38, 70, 120, 0.24)'
        : '0 8px 18px rgba(4, 10, 20, 0.12)',
    };
  }

  function renderItem(item: VocaItem, compact = false) {
    const status = progress[item.id];
    const statusStyle = status ? STATUS_STYLE[status] : null;

    return (
      <article
        key={item.id}
        style={{
          ...itemCardStyle,
          display: 'grid',
          gap: '14px',
          backgroundColor: '#FAFAF8',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              padding: '6px 10px',
              borderRadius: '999px',
              backgroundColor: TYPE_COLOR[item.type],
              color: '#355B84',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            {TYPE_LABEL[item.type]}
          </span>
          {status ? (
            <span
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                backgroundColor: statusStyle?.backgroundColor,
                border: `1px solid ${statusStyle?.borderColor}`,
                color: statusStyle?.color,
                fontSize: '12px',
                fontWeight: 900,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          ) : null}
        </div>

        {item.type === 'word' || item.type === 'phrase' || item.type === 'pattern' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: item.speakable ? '1fr auto' : '1fr',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#07162F', fontSize: compact ? '26px' : '34px', fontWeight: 900 }}>
                {item.term}
              </div>
              {item.speakable ? (
                <button
                  onClick={() => speak(item)}
                  type="button"
                  aria-label={`${getSpeakText(item)} pronunciation`}
                  style={speakerButtonStyle}
                >
                  🔊
                </button>
              ) : null}
            </div>

            <div
              style={meaningBoxStyle}
            >
              {hideMeaning ? '뜻 가림' : `${item.pos ? `(${item.pos}) ` : ''}${item.meaning ?? ''}`}
            </div>
          </>
        ) : item.type === 'blank' ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: item.speakable ? '1fr auto' : '1fr',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#07162F', fontSize: compact ? '26px' : '34px', fontWeight: 900 }}>
                {item.prompt}
              </div>
              {item.speakable ? (
                <button
                  onClick={() => speak(item)}
                  type="button"
                  aria-label={`${getSpeakText(item)} pronunciation`}
                  style={speakerButtonStyle}
                >
                  🔊
                </button>
              ) : null}
            </div>
            <div
              style={meaningBoxStyle}
            >
              {hideMeaning ? '정답 가림' : item.answer}
            </div>
          </>
        ) : item.type === 'grammar' ? (
          <>
            <div style={{ color: '#07162F', fontSize: compact ? '22px' : '28px', fontWeight: 900, lineHeight: 1.55 }}>
              {hideMeaning ? item.prompt : item.answerText ?? item.rawText}
            </div>
            <div
              style={{ ...meaningBoxStyle, fontSize: '18px' }}
            >
              {hideMeaning ? '정답 가림' : `정답: ${(item.answers ?? []).join(' / ')}`}
            </div>
          </>
        ) : item.type === 'group' ? (
          <>
            <div style={{ color: '#07162F', fontSize: '28px', fontWeight: 900 }}>{item.title}</div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                fontSize: '17px',
                fontWeight: 800,
                color: '#07162F',
                borderRadius: '18px',
                backgroundColor: '#EEF3F8',
                border: '1px solid #D9E3EE',
                padding: '15px',
              }}
            >
              {hideMeaning ? '내용 가림' : (item.lines ?? []).join('\n')}
            </div>
          </>
        ) : item.type === 'note' ? (
          <>
            <div style={{ color: '#07162F', fontSize: '28px', fontWeight: 900 }}>* {item.title}</div>
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                fontSize: '17px',
                fontWeight: 800,
                color: '#3F5878',
              }}
            >
              {(item.lines ?? []).join('\n') || item.rawText}
            </div>
          </>
        ) : (
          <div style={{ color: '#3F5878', lineHeight: 1.8, fontSize: '17px', fontWeight: 800 }}>{item.rawText}</div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
          }}
        >
          {(['confusing', 'unknown', 'known'] as VocaKnowledgeStatus[]).map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setStatus(item.id, statusKey)}
              type="button"
              style={{
                ...bigButtonStyle,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                minWidth: 0,
                whiteSpace: 'nowrap',
                backgroundColor: STATUS_STYLE[statusKey].backgroundColor,
                borderColor: STATUS_STYLE[statusKey].borderColor,
                color: STATUS_STYLE[statusKey].color,
                fontSize: '14px',
                padding: '12px 8px',
                minHeight: '48px',
                boxShadow:
                  status === statusKey
                    ? `inset 0 0 0 2px ${STATUS_STYLE[statusKey].borderColor}`
                    : '0 5px 14px rgba(15, 35, 60, 0.08)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '22px',
                  height: '22px',
                  borderRadius: '999px',
                  backgroundColor: STATUS_STYLE[statusKey].iconBackgroundColor,
                  border: `1.5px solid ${STATUS_STYLE[statusKey].iconBorderColor}`,
                  color: STATUS_STYLE[statusKey].iconColor,
                  fontSize: '13px',
                  fontWeight: 900,
                  lineHeight: 1,
                  flex: '0 0 auto',
                }}
              >
                {STATUS_ICON[statusKey]}
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{STATUS_LABEL[statusKey]}</span>
            </button>
          ))}
        </div>
      </article>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <header style={{ ...panelStyle, backgroundColor: '#151B24', borderColor: 'rgba(226, 232, 240, 0.11)' }}>
          <Link
            href="/student"
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              marginBottom: '14px',
              padding: '10px 13px',
              borderRadius: '12px',
              border: '1px solid rgba(226, 232, 240, 0.14)',
              backgroundColor: '#11161D',
              color: '#F5F2EB',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 900,
            }}
          >
            ← 학생 메인으로
          </Link>
          <div style={{ color: '#C8B99D', fontSize: '14px', fontWeight: 900, marginBottom: '8px' }}>
            Danny TOEIC Student Page
          </div>
          <h1 style={{ margin: 0, color: '#F7F8FA', fontSize: '34px', lineHeight: 1.15, fontWeight: 900 }}>
            Danny Voca 단어암기
          </h1>
          <p style={{ margin: '10px 0 0', color: '#C9D2DD', lineHeight: 1.65, fontWeight: 800 }}>
            {vocaSet.displayTitle || vocaSet.title}
          </p>
        </header>

        <section style={{ ...panelStyle, display: 'grid', gap: '12px' }}>
          <div style={{ color: '#F4F4F2', fontSize: '20px', fontWeight: 900 }}>내 단어 세트 선택</div>
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

            <select
              value={track}
              onChange={(e) => chooseTrack(e.target.value as VocaTrack)}
              style={selectStyle}
              disabled={Boolean(inferredTrack)}
            >
              {allowedTracks.map((option) => (
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
                  {option === '통합' ? '통합본' : option}
              </option>
            ))}
            </select>

            <div
              style={{
                ...bigButtonStyle,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#E7EDF2',
                borderColor: '#CBD5E1',
                color: '#394350',
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
                    backgroundColor: vocaSet.id === set.id ? '#5C84B8' : '#F4F5F7',
                    borderColor: vocaSet.id === set.id ? '#5C84B8' : '#5E7EAB',
                    color: vocaSet.id === set.id ? '#FFFFFF' : '#2E4B70',
                  }}
                >
                  {set.displayTitle || set.title}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ color: '#C9D2DD', fontWeight: 900, lineHeight: 1.6 }}>
              선택한 반/진도/버전으로 업로드된 세트가 없어 샘플 세트를 표시합니다.
            </div>
          )}

          {isSampleMode ? null : (
            <div style={{ color: '#D5C8A9', fontSize: '13px', fontWeight: 900 }}>
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
            <div style={{ color: '#F7F8FA', fontSize: '24px', fontWeight: 900 }}>{vocaSet.items.length}</div>
            <div style={{ color: '#C9D2DD', fontSize: '12px', fontWeight: 900 }}>전체</div>
          </div>
          <div>
            <div style={{ color: '#F7F8FA', fontSize: '24px', fontWeight: 900 }}>{knownCount}</div>
            <div style={{ color: '#C9D2DD', fontSize: '12px', fontWeight: 900 }}>알아요</div>
          </div>
          <div>
            <div style={{ color: '#F7F8FA', fontSize: '24px', fontWeight: 900 }}>{reviewCount}</div>
            <div style={{ color: '#C9D2DD', fontSize: '12px', fontWeight: 900 }}>복습</div>
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
            style={modeButtonStyle(hideMeaning)}
          >
            뜻 가리고 보기
          </button>
          <button
            onClick={() => {
              setCardMode((prev) => !prev);
              setCurrentIndex(0);
            }}
            type="button"
            style={modeButtonStyle(cardMode)}
          >
            카드 넘기기
          </button>
          <button
            onClick={() => {
              setReviewOnly((prev) => !prev);
              setCurrentIndex(0);
            }}
            type="button"
            style={modeButtonStyle(reviewOnly)}
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
            style={modeButtonStyle(!hideMeaning && !cardMode && !reviewOnly)}
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
              <button onClick={() => moveCard(-1)} type="button" style={modeButtonStyle(false)}>
                이전
              </button>
              <button onClick={() => moveCard(1)} type="button" style={modeButtonStyle(false)}>
                다음
              </button>
            </div>
            <div style={{ textAlign: 'center', color: '#C9D2DD', fontWeight: 900 }}>
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
