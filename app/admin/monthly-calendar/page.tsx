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
  sixHundredOnlyDates?: number[];
  monthlyDennyDates?: number[];
  specialDates: SpecialDate[];
  d1SpecialDates: SpecialDate[];
  toeicTestDates: number[];
  memo: string;
};

type PagodaWeekImage = {
  id: string;
  url: string;
  alt: string;
  storagePath?: string;
  sortOrder: number;
};

type MainPagodaWeek = {
  isEnabled: boolean;
  title: string;
  image: PagodaWeekImage | null;
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
  const [sixHundredOnlyText, setSixHundredOnlyText] = useState('');
  const [monthlyDennyText, setMonthlyDennyText] = useState('8, 16');
  const [specialText, setSpecialText] = useState('');
  const [d1Text, setD1Text] = useState('30: D-1 특강');
  const [toeicText, setToeicText] = useState('31');
  const [memo, setMemo] = useState('');
  const [pagodaWeek, setPagodaWeek] = useState<MainPagodaWeek>({
    isEnabled: false,
    title: '파고다위크 안내',
    image: null,
  });
  const [pagodaMessage, setPagodaMessage] = useState('');
  const [isPagodaSaving, setIsPagodaSaving] = useState(false);
  const [isUploadingPagoda, setIsUploadingPagoda] = useState(false);

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
        const response = await fetch('/api/get-monthly-calendar', { cache: 'no-store' });
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
        setSixHundredOnlyText(toNumberLine(item.sixHundredOnlyDates ?? []));
        setMonthlyDennyText(toNumberLine(item.monthlyDennyDates ?? []));
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
    if (isChecking) return;

    async function loadPagodaWeek() {
      try {
        const response = await fetch('/api/main-pagoda-week?admin=1');
        const result = await response.json();

        if (result.success && result.pagodaWeek) {
          setPagodaWeek({
            isEnabled: Boolean(result.pagodaWeek.isEnabled),
            title: String(result.pagodaWeek.title ?? '파고다위크 안내'),
            image: result.pagodaWeek.image ?? null,
          });
        }
      } catch (error) {
        console.error(error);
        setPagodaMessage('파고다위크 이미지를 불러오지 못했습니다.');
      }
    }

    loadPagodaWeek();
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
  const sixHundredOnlyDates = useMemo(
    () => parseNumberLine(sixHundredOnlyText),
    [sixHundredOnlyText]
  );
  const monthlyDennyDates = useMemo(
    () => parseNumberLine(monthlyDennyText),
    [monthlyDennyText]
  );
  const toeicTestDates = useMemo(() => parseNumberLine(toeicText), [toeicText]);
  const specialDates = useMemo(
    () => parseSpecialLines(specialText, '월간데니'),
    [specialText]
  );
  const d1SpecialDates = useMemo(
    () => parseSpecialLines(d1Text, 'D-1 특강'),
    [d1Text]
  );

  const weeks = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const specialMap = useMemo(() => {
    const map = new Map<number, string[]>();

    for (const day of monthlyDennyDates) {
      const prev = map.get(day) ?? [];
      map.set(day, [...prev, '월간데니']);
    }

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
  }, [monthlyDennyDates, specialDates, d1SpecialDates, toeicTestDates]);

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
        sixHundredOnlyDates,
        monthlyDennyDates,
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

  function setNumberList(
    currentValues: number[],
    setter: (value: string) => void,
    day: number,
    checked: boolean
  ) {
    const next = checked
      ? Array.from(new Set([...currentValues, day]))
      : currentValues.filter((value) => value !== day);

    setter(toNumberLine(next.sort((a, b) => a - b)));
  }

  async function handlePagodaUpload(file: File | null) {
    if (!file) return;

    setIsUploadingPagoda(true);
    setPagodaMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-main-pagoda-week-image', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (result.success && result.image) {
        setPagodaWeek((current) => ({
          ...current,
          image: result.image,
        }));
        setPagodaMessage('이미지가 업로드되었습니다. 저장하기를 눌러 메인에 반영하세요.');
      } else {
        setPagodaMessage(result.message ?? '이미지 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setPagodaMessage('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploadingPagoda(false);
    }
  }

  async function handlePagodaSave() {
    setIsPagodaSaving(true);
    setPagodaMessage('');

    try {
      const response = await fetch('/api/main-pagoda-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pagodaWeek),
      });
      const result = await response.json();

      if (result.success) {
        setPagodaWeek({
          isEnabled: Boolean(result.pagodaWeek?.isEnabled),
          title: String(result.pagodaWeek?.title ?? pagodaWeek.title),
          image: result.pagodaWeek?.image ?? null,
        });
        setPagodaMessage('메인 파고다위크 설정이 저장되었습니다.');
      } else {
        setPagodaMessage(result.message ?? '파고다위크 설정 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error(error);
      setPagodaMessage('파고다위크 설정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsPagodaSaving(false);
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
    color: '#111827',
    caretColor: '#111827',
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
  const sixHundredOnlyFill = '#726554';
  const toeicFill = '#2563eb';
  const specialFill = '#0f766e';

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
      description="월수반 수업일, 화목반 수업일, 월간데니, D-1특강, 토익시험일을 입력하고 학생용 한달일정을 관리합니다."
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

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>600반 추가수업</label>
              <textarea
                value={sixHundredOnlyText}
                onChange={(e) => setSixHundredOnlyText(e.target.value)}
                style={{
                  ...textareaStyle,
                  minHeight: '80px',
                }}
                placeholder="예: 24, 25"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>날짜별 캘린더 표시 직접 설정</label>
              <div
                style={{
                  display: 'grid',
                  gap: '8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: isMobile ? '10px' : '14px',
                  backgroundColor: '#fcfcfb',
                }}
              >
                {Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => {
                  const day = index + 1;
                  const isMonthlyDenny = monthlyDennyDates.includes(day);

                  return (
                    <div
                      key={day}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '56px repeat(4, minmax(110px, auto)) minmax(160px, 1fr)',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        backgroundColor: 'white',
                      }}
                    >
                      <strong style={{ color: '#111827' }}>{day}일</strong>
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={monWedDates.includes(day)}
                          onChange={(e) =>
                            setNumberList(monWedDates, setMonWedText, day, e.target.checked)
                          }
                        />
                        월수반
                      </label>
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={tueThuDates.includes(day)}
                          onChange={(e) =>
                            setNumberList(tueThuDates, setTueThuText, day, e.target.checked)
                          }
                        />
                        화목반
                      </label>
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={sixHundredOnlyDates.includes(day)}
                          onChange={(e) =>
                            setNumberList(
                              sixHundredOnlyDates,
                              setSixHundredOnlyText,
                              day,
                              e.target.checked
                            )
                          }
                        />
                        600반 추가수업
                      </label>
                      <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={toeicTestDates.includes(day)}
                          onChange={(e) =>
                            setNumberList(toeicTestDates, setToeicText, day, e.target.checked)
                          }
                        />
                        토익시험일
                      </label>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'auto minmax(120px, 1fr)',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isMonthlyDenny}
                            onChange={(e) =>
                              setNumberList(
                                monthlyDennyDates,
                                setMonthlyDennyText,
                                day,
                                e.target.checked
                              )
                            }
                          />
                          월간데니
                        </label>
                        <input
                          value={isMonthlyDenny ? '월간데니' : ''}
                          readOnly
                          disabled={!isMonthlyDenny}
                          style={{
                            ...inputStyle,
                            padding: '8px 10px',
                            opacity: isMonthlyDenny ? 1 : 0.55,
                          }}
                          placeholder="월간데니"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>월간데니 날짜</label>
              <textarea
                value={monthlyDennyText}
                onChange={(e) => setMonthlyDennyText(e.target.value)}
                style={textareaStyle}
                placeholder="예: 8, 16"
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
              marginBottom: '16px',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#111827' }}>
                메인 파고다위크 이미지
              </h2>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: '14px' }}>
                메인 로그인 페이지 안내문 아래, 월간 캘린더 위에만 표시됩니다.
              </p>
            </div>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                color: '#111827',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={pagodaWeek.isEnabled}
                onChange={(e) =>
                  setPagodaWeek((current) => ({
                    ...current,
                    isEnabled: e.target.checked,
                  }))
                }
                style={{ width: '18px', height: '18px' }}
              />
              {pagodaWeek.isEnabled ? 'ON' : 'OFF'}
            </label>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle}>이미지 제목/대체문구</label>
              <input
                value={pagodaWeek.title}
                onChange={(e) =>
                  setPagodaWeek((current) => ({
                    ...current,
                    title: e.target.value,
                    image: current.image
                      ? {
                          ...current.image,
                          alt: e.target.value,
                        }
                      : current.image,
                  }))
                }
                style={inputStyle}
                placeholder="파고다위크 안내"
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '10px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '12px 18px',
                  backgroundColor: 'white',
                  color: '#111827',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '15px',
                  cursor: isUploadingPagoda ? 'wait' : 'pointer',
                  fontWeight: 700,
                }}
              >
                {isUploadingPagoda ? '업로드 중...' : pagodaWeek.image ? '이미지 교체' : '이미지 업로드'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePagodaUpload(e.target.files?.[0] ?? null)}
                  disabled={isUploadingPagoda}
                  style={{ display: 'none' }}
                />
              </label>

              <button
                type="button"
                onClick={() =>
                  setPagodaWeek((current) => ({
                    ...current,
                    image: null,
                  }))
                }
                disabled={!pagodaWeek.image}
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#fff1f2',
                  color: '#be123c',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  fontSize: '15px',
                  cursor: pagodaWeek.image ? 'pointer' : 'not-allowed',
                  opacity: pagodaWeek.image ? 1 : 0.45,
                  fontWeight: 700,
                }}
              >
                이미지 삭제
              </button>

              <button
                type="button"
                onClick={handlePagodaSave}
                disabled={isPagodaSaving}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  cursor: 'pointer',
                  opacity: isPagodaSaving ? 0.7 : 1,
                  fontWeight: 700,
                }}
              >
                {isPagodaSaving ? '저장 중...' : '파고다위크 저장'}
              </button>
            </div>

            {pagodaWeek.image?.url ? (
              <img
                src={pagodaWeek.image.url}
                alt={pagodaWeek.image.alt || pagodaWeek.title || '파고다위크 안내'}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                }}
              />
            ) : (
              <div
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '14px',
                  padding: '24px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                등록된 파고다위크 이미지가 없습니다.
              </div>
            )}

            {pagodaMessage && (
              <p
                style={{
                  margin: 0,
                  color:
                    pagodaMessage.includes('저장') || pagodaMessage.includes('업로드')
                      ? '#0f766e'
                      : '#b91c1c',
                  fontWeight: 600,
                  lineHeight: 1.6,
                }}
              >
                {pagodaMessage}
              </p>
            )}
          </div>
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
                      backgroundColor: sixHundredOnlyFill,
                      display: 'inline-block',
                    }}
                  />
                  600반 추가수업
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      border: `2px solid ${specialFill}`,
                      display: 'inline-block',
                    }}
                  />
                  D-1특강
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      border: `2px solid ${specialFill}`,
                      display: 'inline-block',
                    }}
                  />
                  월간데니
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '999px',
                      border: `2px solid ${toeicFill}`,
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
                    const isSixHundredOnly =
                      cell.isCurrentMonth && sixHundredOnlyDates.includes(cell.day);
                    const isToeic = cell.isCurrentMonth && toeicTestDates.includes(cell.day);
                    const labels = cell.isCurrentMonth ? specialMap.get(cell.day) ?? [] : [];
                    const isSpecial = labels.some((label) => !label.includes('토익'));
                    const displayLabels = [
                      ...(isMonWed ? ['월수반'] : []),
                      ...(isTueThu ? ['화목반'] : []),
                      ...labels,
                    ];

                    let backgroundColor = 'transparent';
                    let textColor = '#44403c';
                    let border = '1px solid transparent';

                    if (!cell.isCurrentMonth) {
                      textColor = '#cbd5e1';
                    } else if (isSixHundredOnly) {
                      backgroundColor = 'transparent';
                      textColor = sixHundredOnlyFill;
                      border = isMobile
                        ? `2px solid ${sixHundredOnlyFill}`
                        : `3px solid ${sixHundredOnlyFill}`;
                    } else if (isTueThu) {
                      backgroundColor = tueThuFill;
                      textColor = 'white';
                    } else if (isMonWed) {
                      backgroundColor = monWedFill;
                      textColor = '#111827';
                    }

                    if (cell.isCurrentMonth && isSpecial) {
                      border = isMobile ? `2px solid ${specialFill}` : `3px solid ${specialFill}`;
                      backgroundColor = 'transparent';
                      textColor = specialFill;
                    } else if (cell.isCurrentMonth && isToeic) {
                      border = isMobile ? `1.5px solid ${toeicFill}` : `2px solid ${toeicFill}`;
                      if (!isMonWed && !isTueThu && !isSixHundredOnly) {
                        backgroundColor = 'transparent';
                        textColor = toeicFill;
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

                        {cell.isCurrentMonth && isSixHundredOnly && (
                          <div
                            style={{
                              marginTop: isMobile ? '3px' : '5px',
                              textAlign: 'center',
                              fontSize: isMobile ? '8px' : '11px',
                              color: sixHundredOnlyFill,
                              lineHeight: 1,
                              fontWeight: 800,
                            }}
                          >
                            600
                          </div>
                        )}

                        {cell.isCurrentMonth && displayLabels.length > 0 && (
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
                            {displayLabels.join('\n')}
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
