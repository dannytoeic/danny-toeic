'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type LoggedInStudent = {
  id: string;
  name: string;
  username: string;
  classKey?: string;
  classKeys?: string[];
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
};

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
  toeicTestDates?: number[];
  memo: string;
};

type TimetableRow = {
  time: string;
  class600MonWed: string;
  class600TueThu: string;
  class800MonWed: string;
  class800TueThu: string;
};

type MonthlyTimetableItem = {
  yearMonth: string;
  title: string;
  rows: TimetableRow[];
  memo: string;
};

function getMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();

  const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];

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

async function safeFetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`${url} 요청 실패 (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${url} 응답이 JSON이 아닙니다.`);
  }

  return response.json();
}

export default function HomePage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [calendarItem, setCalendarItem] = useState<MonthlyCalendarItem | null>(null);
  const [timetableItem, setTimetableItem] = useState<MonthlyTimetableItem | null>(null);
  const [calendarMessage, setCalendarMessage] = useState('');
  const [timetableMessage, setTimetableMessage] = useState('');

  useEffect(() => {
    async function loadCalendar() {
      try {
        const result = await safeFetchJson<{
          success: boolean;
          item?: MonthlyCalendarItem;
          message?: string;
        }>('/api/get-monthly-calendar');

        if (result.success && result.item) {
          setCalendarItem(result.item);
          setCalendarMessage('');
        } else {
          setCalendarMessage(result.message ?? '월간 캘린더를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error(error);
        setCalendarMessage('월간 캘린더를 불러오는 중 오류가 발생했습니다.');
      }
    }

    async function loadTimetable() {
      try {
        const result = await safeFetchJson<{
          success: boolean;
          item?: MonthlyTimetableItem;
          message?: string;
        }>('/api/get-monthly-timetable');

        if (result.success && result.item) {
          setTimetableItem(result.item);
          setTimetableMessage('');
        } else {
          setTimetableMessage(result.message ?? '월간 시간표를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error(error);
        setTimetableMessage('월간 시간표를 불러오는 중 오류가 발생했습니다.');
      }
    }

    loadCalendar();
    loadTimetable();
  }, []);

  const calendarWeeks = useMemo(() => {
    if (!calendarItem) return [];
    return getMonthMatrix(calendarItem.year, calendarItem.month);
  }, [calendarItem]);

  const specialMap = useMemo(() => {
    const map = new Map<number, string[]>();

    if (!calendarItem) return map;

    for (const item of calendarItem.specialDates ?? []) {
      const prev = map.get(item.day) ?? [];
      map.set(item.day, [...prev, item.label]);
    }

    for (const item of calendarItem.d1SpecialDates ?? []) {
      const prev = map.get(item.day) ?? [];
      map.set(item.day, [...prev, item.label]);
    }

    if (Array.isArray(calendarItem.toeicTestDates)) {
      for (const day of calendarItem.toeicTestDates) {
        const prev = map.get(day) ?? [];
        map.set(day, [...prev, '토익시험']);
      }
    }

    return map;
  }, [calendarItem]);

  async function handleStudentLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage('');

    try {
      const response = await fetch('/api/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!result.success || !result.student) {
        setLoginMessage(result.message ?? '로그인에 실패했습니다.');
        return;
      }

      const student = result.student as LoggedInStudent;
      localStorage.setItem('loggedInStudent', JSON.stringify(student));
      router.push('/student');
    } catch (error) {
      console.error(error);
      setLoginMessage('로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingIn(false);
    }
  }

  const shellCardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    boxShadow: '0 6px 24px rgba(15, 23, 42, 0.05)',
  };

  const singleMemoBoxStyle: React.CSSProperties = {
    backgroundColor: '#fafaf9',
    border: '1px solid #e7e5e4',
    borderRadius: '16px',
    padding: '18px',
    color: '#57534e',
    fontSize: '14px',
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    minHeight: '220px',
  };

  const monWedFill = '#cbbfb0';
  const tueThuFill = '#57534e';
  const sharedHeaderBg = '#f3f0e8';

  function compactTimetableText(text: string, isMobile: boolean) {
    if (!isMobile) return text;
    if (text === '800 RC + LC') return '800 R+L';
    return text;
  }

  function renderCalendarSection(isMobile: boolean) {
    const board = (
      <div
        className={isMobile ? 'mobileCalendarScaleWrap' : undefined}
        style={{
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div className={isMobile ? 'mobileCalendarScaleInner' : undefined}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              backgroundColor: '#fafaf9',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                style={{
                  padding: '12px 8px',
                  textAlign: 'center',
                  fontWeight: 700,
                  color: '#57534e',
                  fontSize: '15px',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '0' }}>
            {calendarWeeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  borderBottom:
                    weekIndex === calendarWeeks.length - 1 ? 'none' : '1px solid #e5e7eb',
                }}
              >
                {week.map((cell, index) => {
                  const isMonWed =
                    cell.isCurrentMonth &&
                    (calendarItem?.monWedDates ?? []).includes(cell.day);
                  const isTueThu =
                    cell.isCurrentMonth &&
                    (calendarItem?.tueThuDates ?? []).includes(cell.day);
                  const labels = cell.isCurrentMonth ? specialMap.get(cell.day) ?? [] : [];
                  const isSpecial = labels.some((label) => !label.includes('토익'));
                  const isToeic = labels.some((label) => label.includes('토익'));

                  let backgroundColor = 'transparent';
                  let textColor = '#44403c';
                  let border = '1px solid transparent';

                  if (!cell.isCurrentMonth) {
                    textColor = '#d6d3d1';
                  } else if (isTueThu) {
                    backgroundColor = tueThuFill;
                    textColor = 'white';
                  } else if (isMonWed) {
                    backgroundColor = monWedFill;
                    textColor = '#111827';
                  }

                  if (cell.isCurrentMonth && isSpecial) {
                    border = `3px solid ${tueThuFill}`;
                    backgroundColor = 'transparent';
                    textColor = tueThuFill;
                  } else if (cell.isCurrentMonth && isToeic) {
                    border = '2px solid #cbd5e1';
                    if (!isMonWed && !isTueThu) {
                      backgroundColor = 'transparent';
                      textColor = '#64748b';
                    }
                  }

                  return (
                    <div
                      key={`${weekIndex}-${index}`}
                      style={{
                        minHeight: '98px',
                        borderRight: index === 6 ? 'none' : '1px solid #e5e7eb',
                        padding: '10px 8px',
                      }}
                    >
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '999px',
                          margin: '0 auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '17px',
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
                            marginTop: '8px',
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#57534e',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            fontWeight: 500,
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
      </div>
    );

    return (
      <section
        style={{
          ...shellCardStyle,
          padding: isMobile ? '14px' : '26px',
        }}
      >
        <div style={{ marginBottom: isMobile ? '8px' : '14px' }}>
          <div
            style={{
              fontSize: isMobile ? '12px' : '18px',
              color: '#78716c',
              marginBottom: '6px',
            }}
          >
            {calendarItem?.year ?? ''}
          </div>

          <div
            style={{
              fontSize: isMobile ? '34px' : '62px',
              fontWeight: 700,
              lineHeight: 1,
              color: '#44403c',
              letterSpacing: '-0.04em',
            }}
          >
            {calendarItem
              ? `${calendarItem.month} ${new Date(
                  calendarItem.year,
                  calendarItem.month - 1,
                  1
                ).toLocaleString('en-US', { month: 'long' })}`
              : '5 May'}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: isMobile ? '10px' : '18px',
            alignItems: 'center',
            marginBottom: isMobile ? '6px' : '10px',
            color: '#57534e',
            fontSize: isMobile ? '10px' : '14px',
            fontWeight: 600,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: isMobile ? '9px' : '14px',
                height: isMobile ? '9px' : '14px',
                borderRadius: '999px',
                backgroundColor: monWedFill,
                display: 'inline-block',
              }}
            />
            월수반
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: isMobile ? '9px' : '14px',
                height: isMobile ? '9px' : '14px',
                borderRadius: '999px',
                backgroundColor: tueThuFill,
                display: 'inline-block',
              }}
            />
            화목반
          </div>
        </div>

        {calendarMessage ? (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              color: '#64748b',
            }}
          >
            {calendarMessage}
          </div>
        ) : calendarItem ? (
          board
        ) : null}
      </section>
    );
  }

  function renderTimetableSection(isMobile: boolean) {
    const board = (
      <div
        className={isMobile ? 'mobileTimetableScaleWrap' : undefined}
        style={{
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}
      >
        <div className={isMobile ? 'mobileTimetableScaleInner' : undefined}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'fixed',
              textAlign: 'center',
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                  }}
                />
                <th
                  colSpan={2}
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    fontSize: '17px',
                    color: '#44403c',
                  }}
                >
                  600
                </th>
                <th
                  colSpan={2}
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    fontSize: '17px',
                    color: '#44403c',
                  }}
                >
                  800
                </th>
              </tr>
              <tr>
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                  }}
                />
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    color: '#57534e',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  월수
                </th>
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    color: '#57534e',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  화목
                </th>
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    color: '#57534e',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  월수
                </th>
                <th
                  style={{
                    border: '1px solid #e5e7eb',
                    backgroundColor: sharedHeaderBg,
                    padding: '10px 6px',
                    color: '#57534e',
                    fontSize: '14px',
                    fontWeight: 700,
                  }}
                >
                  화목
                </th>
              </tr>
            </thead>

            <tbody>
              {timetableItem?.rows.map((row, index) => (
                <tr key={index}>
                  <td
                    style={{
                      border: '1px solid #e5e7eb',
                      backgroundColor: '#fafaf9',
                      padding: '12px 6px',
                      fontWeight: 600,
                      color: '#57534e',
                      fontSize: '13px',
                      lineHeight: 1.4,
                    }}
                  >
                    {row.time}
                  </td>

                  <td
                    style={{
                      border: '1px solid #e5e7eb',
                      backgroundColor: row.class600MonWed ? monWedFill : 'white',
                      padding: '12px 6px',
                      color: row.class600MonWed ? '#111827' : '#cbd5e1',
                      fontSize: '14px',
                      fontWeight: row.class600MonWed ? 700 : 400,
                      lineHeight: 1.4,
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {compactTimetableText(row.class600MonWed || '-', isMobile)}
                  </td>

                  <td
                    style={{
                      border: '1px solid #e5e7eb',
                      backgroundColor: row.class600TueThu ? monWedFill : 'white',
                      padding: '12px 6px',
                      color: row.class600TueThu ? '#111827' : '#cbd5e1',
                      fontSize: '14px',
                      fontWeight: row.class600TueThu ? 700 : 400,
                      lineHeight: 1.4,
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {compactTimetableText(row.class600TueThu || '-', isMobile)}
                  </td>

                  <td
                    style={{
                      border: '1px solid #e5e7eb',
                      backgroundColor: row.class800MonWed ? tueThuFill : 'white',
                      padding: '12px 6px',
                      color: row.class800MonWed ? 'white' : '#cbd5e1',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: row.class800MonWed ? 700 : 400,
                      lineHeight: 1.4,
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {compactTimetableText(row.class800MonWed || '-', isMobile)}
                  </td>

                  <td
                    style={{
                      border: '1px solid #e5e7eb',
                      backgroundColor: row.class800TueThu ? tueThuFill : 'white',
                      padding: '12px 6px',
                      color: row.class800TueThu ? 'white' : '#cbd5e1',
                      fontSize: isMobile ? '13px' : '14px',
                      fontWeight: row.class800TueThu ? 700 : 400,
                      lineHeight: 1.4,
                      wordBreak: 'keep-all',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {compactTimetableText(row.class800TueThu || '-', isMobile)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    return (
      <section
        style={{
          ...shellCardStyle,
          padding: isMobile ? '14px' : '26px',
        }}
      >
        <div style={{ marginBottom: isMobile ? '10px' : '18px' }}>
          <div
            style={{
              fontSize: isMobile ? '12px' : '16px',
              color: '#78716c',
              marginBottom: '6px',
            }}
          >
            시간표
          </div>

          <div
            style={{
              fontSize: isMobile ? '34px' : '52px',
              fontWeight: 700,
              lineHeight: 1,
              color: '#44403c',
              letterSpacing: '-0.04em',
            }}
          >
            {timetableItem?.title || 'Timetable'}
          </div>
        </div>

        {timetableMessage ? (
          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              color: '#64748b',
            }}
          >
            {timetableMessage}
          </div>
        ) : timetableItem ? (
          board
        ) : null}
      </section>
    );
  }

  function renderLoginSection() {
    return (
      <section style={{ ...shellCardStyle, padding: '24px' }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: '8px',
            fontSize: '26px',
            color: '#111827',
          }}
        >
          수강생 로그인
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: '16px',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: 1.7,
          }}
        >
          수강생 전용 페이지에 로그인해 주세요.
        </p>

        <form onSubmit={handleStudentLogin} style={{ display: 'grid', gap: '12px' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            disabled={isLoggingIn}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#111827',
              color: 'white',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: isLoggingIn ? 0.7 : 1,
            }}
          >
            {isLoggingIn ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Link
            href="/student/signup"
            style={{
              fontSize: '14px',
              color: '#64748b',
              textDecoration: 'none',
              borderBottom: '1px solid #cbd5e1',
              paddingBottom: '1px',
            }}
          >
            회원가입 신청
          </Link>
        </div>

        {loginMessage && (
          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              color: '#475569',
              lineHeight: 1.6,
              fontSize: '14px',
            }}
          >
            {loginMessage}
          </p>
        )}
      </section>
    );
  }

  function renderCalendarMemoSection() {
    return (
      <section style={{ ...shellCardStyle, padding: '24px', minHeight: '100%' }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: '8px',
            fontSize: '26px',
            color: '#111827',
          }}
        >
          메모
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: '16px',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: 1.7,
          }}
        >
          이번 달 일정 관련 참고사항입니다.
        </p>

        <div style={singleMemoBoxStyle}>
          {calendarItem?.memo?.trim() ? calendarItem.memo : '등록된 메모가 없습니다.'}
        </div>
      </section>
    );
  }

  function renderTimetableMemoSection() {
    return (
      <section style={{ ...shellCardStyle, padding: '24px', minHeight: '100%' }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: '8px',
            fontSize: '26px',
            color: '#111827',
          }}
        >
          메모
        </h2>

        <p
          style={{
            marginTop: 0,
            marginBottom: '16px',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: 1.7,
          }}
        >
          시간표 관련 참고사항입니다.
        </p>

        <div style={singleMemoBoxStyle}>
          {timetableItem?.memo?.trim() ? timetableItem.memo : '등록된 메모가 없습니다.'}
        </div>
      </section>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'white',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
        padding: '28px 24px 40px',
      }}
    >
      <div
        style={{
          maxWidth: '1320px',
          margin: '0 auto',
          display: 'grid',
          gap: '24px',
        }}
      >
        <header>
          <h1
            style={{
              margin: 0,
              fontSize: '42px',
              letterSpacing: '-0.03em',
              color: '#1f2937',
            }}
          >
            데니토익
          </h1>
          <p
            style={{
              marginTop: '12px',
              marginBottom: 0,
              color: '#64748b',
              fontSize: '16px',
              lineHeight: 1.7,
            }}
          >
            월간 일정과 시간표를 먼저 확인하신 뒤, 수강생 로그인을 진행해 주세요.
          </p>
        </header>

        <div className="desktopOnly">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)',
              gap: '24px',
              alignItems: 'stretch',
            }}
          >
            {renderCalendarSection(false)}

            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                gap: '24px',
                alignItems: 'stretch',
              }}
            >
              {renderLoginSection()}
              {renderCalendarMemoSection()}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)',
              gap: '24px',
              alignItems: 'stretch',
              marginTop: '24px',
            }}
          >
            {renderTimetableSection(false)}
            {renderTimetableMemoSection()}
          </div>
        </div>

        <div className="mobileOnly">
          <div
            style={{
              display: 'grid',
              gap: '18px',
            }}
          >
            {renderCalendarSection(true)}
            {renderTimetableSection(true)}
            {renderLoginSection()}
            {renderCalendarMemoSection()}
            {renderTimetableMemoSection()}
          </div>
        </div>

        <footer
          style={{
            marginTop: '10px',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '13px',
                lineHeight: 1.8,
              }}
            >
              데니토익 파고다 부산대
              <br />
              상담/문의: 카카오채널 데니토익
              <br />
              all rights reserved
            </div>

            <div style={{ width: '100%', textAlign: 'right' }}>
              <Link
                href="/admin/login"
                style={{
                  color: '#94a3b8',
                  fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                관리자 로그인
              </Link>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .desktopOnly {
          display: block;
        }

        .mobileOnly {
          display: none;
        }

        .mobileCalendarScaleWrap {
          width: 100%;
        }

        .mobileCalendarScaleInner {
          width: 124%;
          transform: scale(0.81);
          transform-origin: top left;
          margin-bottom: -18%;
        }

        .mobileTimetableScaleWrap {
          width: 100%;
        }

        .mobileTimetableScaleInner {
          width: 124%;
          transform: scale(0.81);
          transform-origin: top left;
          margin-bottom: -18%;
        }

        @media (max-width: 768px) {
          .desktopOnly {
            display: none;
          }

          .mobileOnly {
            display: block;
          }

          main {
            padding: 18px 12px 28px !important;
          }
        }
      `}</style>
    </main>
  );
}