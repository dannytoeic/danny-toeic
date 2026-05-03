'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { createVocaSetFromRawText, extractTextFromDocx } from '@/lib/voca/parseVocaDocx';
import {
  getVersionsForCourse,
  makeVocaSetId,
  makeVocaDisplayTitle,
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

  function handleSavePrototype() {
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

    saveVocaSet(nextSet);
    setVocaSet(nextSet);
    setSavedSetId(nextSet.id);
    setMessage(`${displayTitle} 세트를 이 브라우저에 저장했습니다.`);
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
