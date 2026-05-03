'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createVocaSetFromRawText, extractTextFromDocx } from '@/lib/voca/parseVocaDocx';
import {
  deleteVocaSet,
  deleteRemoteVocaSet,
  fetchRemoteVocaSets,
  getVocaSets,
  getVersionsForCourse,
  makeVocaSetId,
  makeVocaDisplayTitle,
  saveRemoteVocaSet,
  saveVocaSet,
  VOCA_COURSES,
  VOCA_DAYS,
  VOCA_TRACKS,
} from '@/lib/voca/storage';
import type {
  VocaCourse,
  VocaDay,
  VocaItem,
  VocaItemType,
  VocaSet,
  VocaTrack,
  VocaVersion,
} from '@/lib/voca/types';

const TYPE_LABEL: Record<VocaItemType, string> = {
  word: '단어형',
  phrase: '표현형',
  note: '정리형',
  misc: '보존',
};

const TYPE_COLOR: Record<VocaItemType, string> = {
  word: '#dbeafe',
  phrase: '#dcfce7',
  note: '#fef3c7',
  misc: '#f1f5f9',
};

function countByType(items: VocaItem[], type: VocaItemType) {
  return items.filter((item) => item.type === type).length;
}

export default function VocaUploadPreview() {
  const [course, setCourse] = useState<VocaCourse>('800');
  const [track, setTrack] = useState<VocaTrack>('A');
  const [version, setVersion] = useState<VocaVersion>('ver.1');
  const [day, setDay] = useState<VocaDay>('Day 1');
  const [rawText, setRawText] = useState('');
  const [vocaSet, setVocaSet] = useState<VocaSet | null>(null);
  const [message, setMessage] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [savedSetId, setSavedSetId] = useState('');
  const [savedSets, setSavedSets] = useState<VocaSet[]>([]);

  const availableVersions = getVersionsForCourse(course);
  const displayTitle = makeVocaDisplayTitle(course, track, version, day);

  const counts = useMemo(() => {
    const items = vocaSet?.items ?? [];
    return {
      all: items.length,
      word: countByType(items, 'word'),
      phrase: countByType(items, 'phrase'),
      note: countByType(items, 'note'),
      misc: countByType(items, 'misc'),
    };
  }, [vocaSet]);

  async function refreshSavedSets() {
    try {
      const remoteSets = await fetchRemoteVocaSets();
      setSavedSets(remoteSets);
    } catch (error) {
      console.error(error);
      setSavedSets(getVocaSets());
      setMessage('서버 저장 목록을 불러오지 못해 이 브라우저의 임시 저장 목록을 표시합니다.');
    }
  }

  useEffect(() => {
    window.setTimeout(() => {
      refreshSavedSets();
    }, 0);
  }, []);

  function buildSetFromText(text: string) {
    return createVocaSetFromRawText({
      rawText: text,
      title: displayTitle,
      course,
      track,
      version,
      day,
    });
  }

  function updateCourse(nextCourse: VocaCourse) {
    setCourse(nextCourse);
    const nextVersions = getVersionsForCourse(nextCourse);
    if (!nextVersions.includes(version)) {
      setVersion(nextVersions[0]);
    }
    setSavedSetId('');
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;

    setIsParsing(true);
    setMessage('');
    setSavedSetId('');

    try {
      const text = await extractTextFromDocx(file);
      setRawText(text);
      setVocaSet(buildSetFromText(text));
      setMessage('문서를 분석했습니다. 선택한 반/진도/버전/Day를 확인한 뒤 저장해 주세요.');
    } catch (error) {
      console.error(error);
      setMessage('.docx 텍스트 추출 중 오류가 발생했습니다.');
    } finally {
      setIsParsing(false);
    }
  }

  function handleAnalyzeText() {
    setVocaSet(buildSetFromText(rawText));
    setSavedSetId('');
    setMessage('입력된 텍스트를 다시 분석했습니다.');
  }

  async function handleSavePrototype() {
    if (!vocaSet) {
      setMessage('먼저 .docx를 업로드하거나 원문 텍스트를 입력해 주세요.');
      return;
    }

    const nextSet: VocaSet = {
      ...vocaSet,
      id: makeVocaSetId(course, track, version, day),
      title: displayTitle,
      displayTitle,
      course,
      track,
      version,
      day,
    };

    try {
      const remoteSets = await saveRemoteVocaSet(nextSet);
      saveVocaSet(nextSet);
      setVocaSet(nextSet);
      setSavedSetId(nextSet.id);
      setSavedSets(remoteSets);
      setMessage(`${displayTitle} 세트를 서버에 저장했습니다. 이제 모바일에서도 보입니다.`);
    } catch (error) {
      console.error(error);
      saveVocaSet(nextSet);
      setVocaSet(nextSet);
      setSavedSetId(nextSet.id);
      await refreshSavedSets();
      setMessage(`${displayTitle} 세트를 이 브라우저에만 임시 저장했습니다.`);
    }
  }

  function handleLoadSavedSet(set: VocaSet) {
    setCourse(set.course);
    setTrack(set.track);
    setVersion(set.version);
    setDay(set.day);
    setVocaSet(set);
    setSavedSetId(set.id);
    setRawText(set.items.map((item) => item.rawText).join('\n'));
    setMessage(`${set.displayTitle || set.title} 세트를 불러왔습니다.`);
  }

  async function handleDeleteSavedSet(id: string) {
    const ok = window.confirm('이 Danny Voca 세트를 삭제하시겠습니까?');
    if (!ok) return;

    try {
      const remoteSets = await deleteRemoteVocaSet(id);
      deleteVocaSet(id);
      setSavedSets(remoteSets);
    } catch (error) {
      console.error(error);
      deleteVocaSet(id);
      await refreshSavedSets();
    }

    if (savedSetId === id) {
      setSavedSetId('');
      setVocaSet(null);
      setRawText('');
    }

    setMessage('저장된 세트를 삭제했습니다.');
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    borderRadius: '14px',
    border: '1px solid #d6d3d1',
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '15px',
    fontWeight: 800,
    outline: 'none',
  };

  const buttonStyle: React.CSSProperties = {
    minHeight: '48px',
    border: 'none',
    borderRadius: '14px',
    padding: '13px 18px',
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <section
        style={{
          backgroundColor: '#fffaf2',
          border: '1px solid #efe3ce',
          borderRadius: '20px',
          padding: '18px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          <select value={course} onChange={(e) => updateCourse(e.target.value as VocaCourse)} style={inputStyle}>
            {VOCA_COURSES.map((option) => (
              <option key={option} value={option}>
                {option}반
              </option>
            ))}
          </select>

          <select value={track} onChange={(e) => setTrack(e.target.value as VocaTrack)} style={inputStyle}>
            {VOCA_TRACKS.map((option) => (
              <option key={option} value={option}>
                {option}진도
              </option>
            ))}
          </select>

          <select
            value={version}
            onChange={(e) => setVersion(e.target.value as VocaVersion)}
            style={inputStyle}
          >
            {availableVersions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select value={day} onChange={(e) => setDay(e.target.value as VocaDay)} style={inputStyle}>
            {VOCA_DAYS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            borderRadius: '18px',
            backgroundColor: '#ffffff',
            border: '1px solid #eadfce',
            padding: '16px',
            color: '#111827',
            fontWeight: 900,
            fontSize: '22px',
          }}
        >
          {displayTitle}
        </div>

        <label
          style={{
            display: 'grid',
            gap: '10px',
            padding: '18px',
            borderRadius: '18px',
            border: '2px dashed #d6d3d1',
            backgroundColor: '#ffffff',
            color: '#374151',
            fontWeight: 900,
          }}
        >
          Word 단어시험지(.docx) 업로드
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            style={{ fontWeight: 800 }}
          />
        </label>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="원문 텍스트가 여기에 표시됩니다. 직접 붙여넣고 분석할 수도 있습니다."
          rows={8}
          style={{
            ...inputStyle,
            lineHeight: 1.7,
            resize: 'vertical',
            fontWeight: 600,
          }}
        />

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleAnalyzeText} style={buttonStyle} type="button">
            텍스트 분석
          </button>
          <button
            onClick={handleSavePrototype}
            style={{ ...buttonStyle, backgroundColor: '#2563eb' }}
            type="button"
          >
            이 조합으로 저장
          </button>
          {savedSetId ? (
            <Link href="/student/danny-voca" style={{ ...buttonStyle, backgroundColor: '#15803d' }}>
              학생 화면에서 보기
            </Link>
          ) : null}
        </div>

        {isParsing ? <div style={{ fontWeight: 900 }}>문서 분석 중...</div> : null}
        {message ? (
          <div style={{ color: '#475569', fontWeight: 900, lineHeight: 1.6 }}>{message}</div>
        ) : null}
      </section>

      <section
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '20px',
          padding: '18px',
          display: 'grid',
          gap: '14px',
        }}
      >
        <div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827' }}>
            저장된 Danny Voca 세트
          </div>
          <div style={{ marginTop: '6px', color: '#64748b', fontWeight: 800 }}>
            PC와 모바일이 함께 보는 서버 저장 목록입니다.
          </div>
        </div>

        {savedSets.length === 0 ? (
          <div
            style={{
              borderRadius: '16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '16px',
              color: '#64748b',
              fontWeight: 800,
              lineHeight: 1.6,
            }}
          >
            저장된 세트가 없습니다. Word 파일을 업로드하고 “이 조합으로 저장”을 눌러 주세요.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {savedSets.map((set) => (
              <div
                key={set.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  gap: '8px',
                  alignItems: 'center',
                  borderRadius: '16px',
                  backgroundColor: savedSetId === set.id ? '#eff6ff' : '#fcfcfb',
                  border: savedSetId === set.id ? '1px solid #bfdbfe' : '1px solid #e5e7eb',
                  padding: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#111827',
                      fontSize: '16px',
                      fontWeight: 900,
                      lineHeight: 1.4,
                    }}
                  >
                    {set.displayTitle || set.title}
                  </div>
                  <div
                    style={{
                      color: '#64748b',
                      fontSize: '13px',
                      fontWeight: 800,
                      marginTop: '4px',
                    }}
                  >
                    전체 {set.items.length}개 · 단어 {countByType(set.items, 'word')}개 · 표현{' '}
                    {countByType(set.items, 'phrase')}개
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleLoadSavedSet(set)}
                  style={{
                    ...buttonStyle,
                    minHeight: '40px',
                    padding: '10px 12px',
                    fontSize: '13px',
                  }}
                >
                  불러오기
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteSavedSet(set.id)}
                  style={{
                    ...buttonStyle,
                    minHeight: '40px',
                    padding: '10px 12px',
                    fontSize: '13px',
                    backgroundColor: '#991b1b',
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {vocaSet ? (
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '18px',
            display: 'grid',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#111827' }}>
              {displayTitle}
            </div>
            <div style={{ marginTop: '8px', color: '#475569', fontWeight: 900 }}>
              전체 {counts.all}개 · 단어 {counts.word}개 · 표현 {counts.phrase}개 · 정리{' '}
              {counts.note}개 · 기타 {counts.misc}개
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px',
            }}
          >
            {(['word', 'phrase', 'note', 'misc'] as VocaItemType[]).map((type) => (
              <div
                key={type}
                style={{
                  borderRadius: '16px',
                  backgroundColor: TYPE_COLOR[type],
                  padding: '14px',
                  color: '#111827',
                  fontWeight: 900,
                }}
              >
                <div style={{ fontSize: '13px', marginBottom: '6px' }}>{TYPE_LABEL[type]}</div>
                <div style={{ fontSize: '28px' }}>{counts[type]}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {vocaSet.items.map((item) => (
              <article
                key={item.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '18px',
                  padding: '16px',
                  backgroundColor: '#fcfcfb',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    backgroundColor: TYPE_COLOR[item.type],
                    color: '#111827',
                    fontSize: '12px',
                    fontWeight: 900,
                    marginBottom: '10px',
                  }}
                >
                  {TYPE_LABEL[item.type]}
                </div>

                {item.type === 'word' || item.type === 'phrase' ? (
                  <div style={{ display: 'grid', gap: '7px' }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827' }}>
                      {item.term}
                    </div>
                    <div style={{ color: '#475569', fontWeight: 800 }}>
                      {item.pos ? `(${item.pos}) ` : ''}
                      {item.meaning}
                    </div>
                  </div>
                ) : item.type === 'note' ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>
                      * {item.title}
                    </div>
                    <div style={{ color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
                      {(item.lines ?? []).join('\n')}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#374151', lineHeight: 1.75 }}>{item.rawText}</div>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
