'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLoggedInAdmin } from '../adminGuard';
import AdminShell from '../AdminShell';

type SpecialDate = {
  day: number;
  label: string;
};

type MonthlyCalendarItem = {
  yearMonth: string;
  year: number;
  month: number;
  monWedDates: number[];
  tueThuDates: number[];
  specialDates: SpecialDate[];
  d1SpecialDates: SpecialDate[];
  toeicTestDates: number[];
  memo: string;
};

function parseNumberLine(text: string): number[] {
  return text
    .split(/[\n, ]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.trunc(v))
    .filter((v) => v >= 1 && v <= 31);
}

function toNumberLine(values: number[]) {
  return values.join(', ');
}

function parseSpecialLines(text: string, defaultLabel: string): SpecialDate[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [dayPart, ...labelParts] = line.split(':');
      const day = Number(dayPart?.trim());
      const label = labelParts.join(':').trim() || defaultLabel;
      return { day, label };
    })
    .filter((item) => Number.isFinite(item.day) && item.day >= 1 && item.day <= 31);
}

function toSpecialLines(values: SpecialDate[]) {
  return values.map((item) => `${item.day}: ${item.label}`).join('\n');
}

function getMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: Array<{
    day: number;
    isCurrentMonth: boolean;
  }> = [];

  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({
      day: prevMonthDays - i,
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      day: cells.length - (firstWeekday + daysInMonth) + 1,
      isCurrentMonth: false,
    });
  }

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

export default function MonthlyCalendarAdminPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const [yearMonth, setYearMonth] = useState('2026-05');
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(5);
  const [monWedText, setMonWedText] = useState('6, 11, 13, 18, 20, 27');
  const [tueThuText, setTueThuText] = useState('7, 12, 14, 19, 21, 26, 28');
  const [specialText, setSpecialText] = useState('8: 관리특강\n16: 관리특강');
  const [d1Text, setD1Text] = useState('30: D-1 특강');
  const [toeicText, setToeicText] = useState('31');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const admin = getLoggedInAdmin();

    if (!admin) {
      router.push('/admin/login');
      return;
    }

    setIsChecking(false);
  }, [router]);

  useEffect(() => {
    if (isChecking) return;

    async function loadData() {
      try {
        const response = await fetch('/api/get-monthly-calendar');
        const result = await response.json();

        if (!result.success || !result.item) {
          setMessage(result.message ?? '월간 캘린더를 불러오지 못했습니다.');
          setIsLoading(false);
          return;
        }

        const item = result.item as MonthlyCalendarItem;

        setYearMonth(item.yearMonth);
        setYear(item.year);
        setMonth(item.month);
        setMonWedText(toNumberLine(item.monWedDates ?? []));
        setTueThuText(toNumberLine(item.tueThuDates ?? []));
        setSpecialText(toSpecialLines(item.specialDates ?? []));
        setD1Text(toSpecialLines(item.d1SpecialDates ?? []));
        setToeicText(toNumberLine(item.toeicTestDates ?? []));
        setMemo(item.memo ?? '');
        setMessage('');
      } catch (error) {
        console.error(error);
        setMessage('월간 캘린더를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [isChecking]);

  useEffect(() => {
    const [y, m] = yearMonth.split('-');
    const nextYear = Number(y);
    const nextMonth = Number(m);

    if (Number.isFinite(nextYear) && Number.isFinite(nextMonth)) {
      setYear(nextYear);
      setMonth(nextMonth);
    }
  }, [yearMonth]);

  const monWedDates = useMemo(() => parseNumberLine(monWedText), [monWedText]);
  const tueThuDates = useMemo(() => parseNumberLine(tueThuText), [tueThuText]);
  const toeicTestDates = useMemo(() => parseNumberLine(toeicText), [toeicText]);
  const specialDates = useMemo(
    () => parseSpecialLines(specialText, '관리특강'),
    [specialText]
  );
  const d1SpecialDates = useMemo(
    () => parseSpecialLines(d1Text, 'D-1 특강'),
    [d1Text]
  );

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const specialMap = useMemo(() => {
    const map = new Map<number, string[]>();

    for (const item of specialDates) {
      const prev = map.get(item.day) ?? [];
      map.set(item.day, [...prev, item.label]);
    }

    for (const item of d1SpecialDates) {
      const prev = map.get(item.day) ?? [];
      map.set(item.day, [...prev, item.label]);
    }

    for (const day of toeicTestDates) {
      const prev = map.get(day) ?? [];
      map.set(day, [...prev, '토익시험']);
    }

    return map;
  }, [specialDates, d1SpecialDates, toeicTestDates]);

  async function handleSave() {
    setIsSaving(true);
    setMessage('');

    try {
      const payload: MonthlyCalendarItem = {
        yearMonth,
        year,
        month,
        monWedDates,
        tueThuDates,
        specialDates,
        d1SpecialDates,
        toeicTestDates,
        memo,
      };

      const response = await fetch('/api/save-monthly-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, setAsCurrent: true }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage('월간 캘린더가 저장되었습니다.');
      } else {
        setMessage(result.message ?? '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    backgroundColor: 'white',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    minHeight: '110px',
    resize: 'vertical',
    lineHeight: 1.6,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '6px',
    color: '#334155',
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  };

  const previewCardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '18px',
    padding: isMobile ? '14px' : '20px',
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  };

  const monWedFill = '#cbbfb0';
  const tueThuFill = '#57534e';

  if (isChecking || isLoading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
          fontFamily: 'Arial, sans-serif',
          color: '#111827',
          textAlign: 'center',
          padding: '20px',
        }}
      >
        월간 캘린더 불러오는 중...
      </main>
    );
  }

  return (
    <AdminShell
      title="월간 캘린더 관리"
      description="월수반 수업일, 화목반 수업일, 특강 날짜, 토익시험일을 입력하고 학생용 한달일정을 관리합니다."
    >
      <div
        style={{
          maxWidth: '1200px',
          width: '100%',
          minWidth: 0,
          display: 'grid',
          gap: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: isMobile ? '14px' : '20px',
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
              gap: '14px 16px',
              width: '100%',
              minWidth: 0,
            }}
          >
            <div>
              <label style={labelStyle}>기준 연월</label>
              <input
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                style={inputStyle}
                placeholder="예: 2026-05"
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: isMobile ? 'stretch' : 'end',
                gap: '12px',
              }}
            >
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  padding: '12px 18px',
                  backgroundColor: '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>

            <div>
              <label style={labelStyle}>월수반 수업일</label>
              <textarea
                value={monWedText}
                onChange={(e) => setMonWedText(e.target.value)}
                style={textareaStyle}
                placeholder="예: 6, 11, 13, 18, 20, 27"
              />
            </div>

            <div>
              <label style={labelStyle}>화목반 수업일</label>
              <textarea
                value={tueThuText}
                onChange={(e) => setTueThuText(e.target.value)}
                style={textareaStyle}
                placeholder="예: 7, 12, 14, 19, 21, 26, 28"
              />
            </div>

            <div>
              <label style={labelStyle}>관리특강 날짜</label>
              <textarea
                value={specialText}
                onChange={(e) => setSpecialText(e.target.value)}
                style={textareaStyle}
                placeholder={'예:\n8: 관리특강\n16: 관리특강'}
              />
            </div>

            <div>
              <label style={labelStyle}>D-1 특강 날짜</label>
              <textarea
                value={d1Text}
                onChange={(e) => setD1Text(e.target.value)}
                style={textareaStyle}
                placeholder={'예:\n30: D-1 특강'}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>토익시험일</label>
              <textarea
                value={toeicText}
                onChange={(e) => setToeicText(e.target.value)}
                style={{
                  ...textareaStyle,
                  minHeight: '90px',
                }}
                placeholder="예: 31"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>오른쪽 메모</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                style={{
                  ...textareaStyle,
                  minHeight: '140px',
                }}
                placeholder={'예:\n5월 일정 참고사항\n결석 보강 관련 안내'}
              />
            </div>
          </div>

          {message && (
            <p
              style={{
                marginTop: '16px',
                marginBottom: 0,
                color: message.includes('저장') ? '#0f766e' : '#475569',
                fontWeight: 600,
                lineHeight: 1.6,
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {message}
            </p>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(280px, 1fr)',
            gap: '18px',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={previewCardStyle}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                marginBottom: '18px',
                gap: '12px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: isMobile ? '14px' : '16px',
                    color: '#64748b',
                    wordBreak: 'keep-all',
                  }}
                >
                  {year}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? '34px' : '54px',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: '#334155',
                    wordBreak: 'keep-all',
                  }}
                >
                  {month}{' '}
                  {new Date(year, month - 1, 1).toLocaleString('en-US', {
                    month: 'long',
                  })}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px 16px',
                  alignItems: 'center',
                  color: '#57534e',
                  fontSize: isMobile ? '12px' : '13px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      backgroundColor: monWedFill,
                      display: 'inline-block',
                    }}
                  />
                  월수반
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      backgroundColor: tueThuFill,
                      display: 'inline-block',
                    }}
                  />
                  화목반
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      border: `2px solid ${tueThuFill}`,
                      display: 'inline-block',
                    }}
                  />
                  특강
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      border: '1px solid #cbd5e1',
                      display: 'inline-block',
                    }}
                  />
                  토익시험일
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                marginBottom: '8px',
                gap: isMobile ? '4px' : '6px',
                fontWeight: 700,
                color: '#475569',
                fontSize: isMobile ? '11px' : '14px',
                textAlign: 'center',
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gap: isMobile ? '4px' : '8px', minWidth: 0 }}>
              {weeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: isMobile ? '4px' : '6px',
                    minWidth: 0,
                  }}
                >
                  {week.map((cell, index) => {
                    const isMonWed = cell.isCurrentMonth && monWedDates.includes(cell.day);
                    const isTueThu = cell.isCurrentMonth && tueThuDates.includes(cell.day);
                    const isToeic = cell.isCurrentMonth && toeicTestDates.includes(cell.day);
                    const labels = cell.isCurrentMonth ? specialMap.get(cell.day) ?? [] : [];
                    const isSpecial = labels.some((label) => !label.includes('토익'));

                    let backgroundColor = 'transparent';
                    let textColor = '#44403c';
                    let border = '1px solid transparent';

                    if (!cell.isCurrentMonth) {
                      textColor = '#cbd5e1';
                    } else if (isTueThu) {
                      backgroundColor = tueThuFill;
                      textColor = 'white';
                    } else if (isMonWed) {
                      backgroundColor = monWedFill;
                      textColor = '#111827';
                    }

                    if (cell.isCurrentMonth && isSpecial) {
                      border = isMobile ? `2px solid ${tueThuFill}` : `3px solid ${tueThuFill}`;
                      backgroundColor = 'transparent';
                      textColor = tueThuFill;
                    } else if (cell.isCurrentMonth && isToeic) {
                      border = isMobile ? '1.5px solid #cbd5e1' : '2px solid #cbd5e1';
                      if (!isMonWed && !isTueThu) {
                        backgroundColor = 'transparent';
                        textColor = '#64748b';
                      }
                    }

                    return (
                      <div
                        key={`${weekIndex}-${index}`}
                        style={{
                          minHeight: isMobile ? '56px' : '86px',
                          border: '1px solid #e5e7eb',
                          borderRadius: isMobile ? '8px' : '12px',
                          padding: isMobile ? '4px' : '8px',
                          backgroundColor: 'white',
                          overflow: 'hidden',
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: isMobile ? '24px' : '40px',
                            height: isMobile ? '24px' : '40px',
                            borderRadius: '999px',
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? '11px' : '16px',
                            fontWeight: 700,
                            color: textColor,
                            backgroundColor,
                            border,
                          }}
                        >
                          {cell.day}
                        </div>

                        {cell.isCurrentMonth && labels.length > 0 && (
                          <div
                            style={{
                              marginTop: isMobile ? '4px' : '6px',
                              textAlign: 'center',
                              fontSize: isMobile ? '8px' : '12px',
                              color: '#475569',
                              lineHeight: 1.25,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'keep-all',
                              overflowWrap: 'break-word',
                            }}
                          >
                            {labels.join('\n')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={previewCardStyle}>
            <h2
              style={{
                marginTop: 0,
                fontSize: isMobile ? '28px' : '24px',
                marginBottom: '12px',
                wordBreak: 'keep-all',
              }}
            >
              메모
            </h2>
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: isMobile ? '16px' : '14px',
                color: '#475569',
                lineHeight: 1.7,
                minHeight: isMobile ? '180px' : '220px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                fontSize: isMobile ? '16px' : '14px',
              }}
            >
              {memo || '등록된 메모가 없습니다.'}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}