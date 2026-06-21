'use client';

import { useMemo } from 'react';

export type SpecialDate = { day: number; label: string };

export type StudentClassCalendarItem = {
  yearMonth: string;
  year: number;
  month: number;
  monWedDates: number[];
  tueThuDates: number[];
  sixHundredOnlyDates: number[];
  monthlyDennyDates: number[];
  specialDates: SpecialDate[];
  d1SpecialDates: SpecialDate[];
  toeicTestDates: number[];
  memo: string;
};

export type StudentClassTimetableRow = {
  time: string;
  class600MonWed: string;
  class600TueThu: string;
  class800MonWed: string;
  class800TueThu: string;
};

export type StudentClassTimetableItem = {
  yearMonth: string;
  title: string;
  rows: StudentClassTimetableRow[];
  memo: string;
};

function getMonthMatrix(year: number, month: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];
  for (let i = firstWeekday - 1; i >= 0; i -= 1) {
    cells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, isCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - (firstWeekday + daysInMonth) + 1, isCurrentMonth: false });
  }
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const monWedFill = '#cbbfb0';
const tueThuFill = '#57534e';
const sixHundredOnlyFill = '#726554';
const specialFill = '#0f766e';
const toeicFill = '#2563eb';

const shellStyle: React.CSSProperties = {
  backgroundColor: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '20px',
  padding: '24px',
  color: '#111827',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
};

export function StudentClassCalendar({
  item,
  isMobile,
}: {
  item: StudentClassCalendarItem;
  isMobile: boolean;
}) {
  const weeks = useMemo(() => getMonthMatrix(item.year, item.month), [item.year, item.month]);
  const labelsByDay = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const entry of item.specialDates ?? []) map.set(entry.day, [...(map.get(entry.day) ?? []), entry.label]);
    for (const entry of item.d1SpecialDates ?? []) map.set(entry.day, [...(map.get(entry.day) ?? []), entry.label]);
    for (const day of item.monthlyDennyDates ?? []) map.set(day, [...(map.get(day) ?? []), '월간데니']);
    for (const day of item.toeicTestDates ?? []) map.set(day, [...(map.get(day) ?? []), '토익시험']);
    return map;
  }, [item]);

  const legend = [
    ['월수반', { backgroundColor: monWedFill }],
    ['화목반', { backgroundColor: tueThuFill }],
    ['600반 추가수업', { border: `3px solid ${sixHundredOnlyFill}` }],
    ['토익시험일', { border: `2px solid ${toeicFill}` }],
    ['D-1특강', { border: `2px solid ${specialFill}` }],
    ['월간데니', { border: `2px solid ${specialFill}` }],
  ] as const;

  return (
    <section style={{ ...shellStyle, padding: isMobile ? '14px' : '26px' }}>
      <div style={{ marginBottom: isMobile ? '10px' : '14px' }}>
        <div style={{ fontSize: isMobile ? '12px' : '18px', color: '#78716c', marginBottom: '6px' }}>{item.year}</div>
        <div style={{ fontSize: isMobile ? '34px' : '62px', fontWeight: 700, lineHeight: 1, color: '#44403c', letterSpacing: '-0.04em' }}>
          {item.month} {new Date(item.year, item.month - 1, 1).toLocaleString('en-US', { month: 'long' })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: isMobile ? '10px' : '18px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px', color: '#57534e', fontSize: isMobile ? '11px' : '14px', fontWeight: 600 }}>
        {legend.map(([label, marker]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: isMobile ? '9px' : '14px', height: isMobile ? '9px' : '14px', borderRadius: '999px', display: 'inline-block', ...marker }} />
            {label}
          </div>
        ))}
      </div>

      <div style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#fafaf9', borderBottom: '1px solid #e5e7eb' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} style={{ padding: isMobile ? '7px 1px' : '10px 4px', textAlign: 'center', fontSize: isMobile ? '10px' : '13px', fontWeight: 700, color: day === 'Sun' ? '#b91c1c' : '#57534e' }}>{day}</div>
          ))}
        </div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: weekIndex === weeks.length - 1 ? 'none' : '1px solid #e5e7eb' }}>
            {week.map((cell, index) => {
              const isMonWed = cell.isCurrentMonth && item.monWedDates.includes(cell.day);
              const isTueThu = cell.isCurrentMonth && item.tueThuDates.includes(cell.day);
              const isSixHundredOnly = cell.isCurrentMonth && item.sixHundredOnlyDates.includes(cell.day);
              const labels = cell.isCurrentMonth ? labelsByDay.get(cell.day) ?? [] : [];
              const isSpecial = labels.some((label) => !label.includes('토익'));
              const isToeic = labels.some((label) => label.includes('토익'));
              let backgroundColor = 'transparent';
              let color = cell.isCurrentMonth ? '#44403c' : '#d6d3d1';
              let border = '1px solid transparent';
              if (isSixHundredOnly) { color = sixHundredOnlyFill; border = `3px solid ${sixHundredOnlyFill}`; }
              else if (isTueThu) { backgroundColor = tueThuFill; color = 'white'; }
              else if (isMonWed) { backgroundColor = monWedFill; color = '#111827'; }
              if (isSpecial) { backgroundColor = 'transparent'; color = specialFill; border = `3px solid ${specialFill}`; }
              else if (isToeic) { border = `2px solid ${toeicFill}`; if (!isMonWed && !isTueThu && !isSixHundredOnly) color = toeicFill; }
              return (
                <div key={`${weekIndex}-${index}`} style={{ minHeight: isMobile ? '62px' : '98px', borderRight: index === 6 ? 'none' : '1px solid #e5e7eb', padding: isMobile ? '5px 2px' : '10px 8px', overflow: 'hidden' }}>
                  <div style={{ width: isMobile ? '30px' : '44px', height: isMobile ? '30px' : '44px', borderRadius: '999px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '13px' : '17px', fontWeight: 700, color, backgroundColor, border }}>{cell.day}</div>
                  {isSixHundredOnly ? <div style={{ marginTop: '4px', textAlign: 'center', fontSize: isMobile ? '9px' : '12px', color: sixHundredOnlyFill, lineHeight: 1, fontWeight: 800 }}>600</div> : null}
                  {labels.length ? <div style={{ marginTop: '4px', textAlign: 'center', fontSize: isMobile ? '8px' : '11px', color: isToeic && !isSpecial ? toeicFill : specialFill, lineHeight: 1.15, fontWeight: 700 }}>{labels.join(' · ')}</div> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {item.memo ? <div style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', color: '#57534e', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.memo}</div> : null}
    </section>
  );
}

export function StudentClassTimetable({ item, isMobile }: { item: StudentClassTimetableItem; isMobile: boolean }) {
  return (
    <section style={{ ...shellStyle, padding: isMobile ? '14px' : '26px' }}>
      <div style={{ fontSize: isMobile ? '12px' : '18px', color: '#78716c', marginBottom: '6px' }}>{item.yearMonth.slice(0, 4)}</div>
      <div style={{ fontSize: isMobile ? '34px' : '52px', fontWeight: 700, lineHeight: 1, color: '#44403c', letterSpacing: '-0.04em', marginBottom: '18px' }}>{item.title || 'Timetable'}</div>
      <div style={{ borderRadius: '16px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: isMobile ? '680px' : 0, borderCollapse: 'collapse', tableLayout: 'fixed', textAlign: 'center' }}>
          <thead>
            <tr>{['', '600 월수', '600 화목', '800 월수', '800 화목'].map((label) => <th key={label} style={{ border: '1px solid #e5e7eb', backgroundColor: '#f3f0e8', padding: '10px 6px', color: '#44403c' }}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {item.rows.map((row, index) => (
              <tr key={index}>
                {[row.time, row.class600MonWed, row.class600TueThu, row.class800MonWed, row.class800TueThu].map((value, column) => {
                  const filled = column > 0 && Boolean(value);
                  const backgroundColor = column === 0 ? '#fafaf9' : filled ? (column <= 2 ? monWedFill : tueThuFill) : 'white';
                  return <td key={column} style={{ border: '1px solid #e5e7eb', padding: isMobile ? '9px 5px' : '12px 6px', color: filled && column >= 3 ? 'white' : value ? '#111827' : '#cbd5e1', backgroundColor, fontWeight: filled ? 700 : 500, whiteSpace: 'pre-wrap' }}>{value || '-'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {item.memo ? <div style={{ marginTop: '12px', padding: '12px', borderRadius: '14px', backgroundColor: '#fafaf9', border: '1px solid #e7e5e4', color: '#57534e', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{item.memo}</div> : null}
    </section>
  );
}
