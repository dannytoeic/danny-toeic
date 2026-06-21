'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  StudentClassCalendar,
  StudentClassCalendarItem,
  StudentClassTimetable,
  StudentClassTimetableItem,
  StudentClassTimetableRow,
} from '../../student/components/StudentClassSchedule';

const DEFAULT_ROWS: StudentClassTimetableRow[] = [
  '09:00-09:50', '10:00-10:50', '11:20-12:10', '12:20-13:10',
  '14:30-15:20', '15:30-16:20', '17:40-19:20', '19:30-20:20', '20:30-21:20',
].map((time) => ({ time, class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' }));

const emptyCalendar: StudentClassCalendarItem = {
  yearMonth: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1,
  monWedDates: [], tueThuDates: [], sixHundredOnlyDates: [], monthlyDennyDates: [],
  specialDates: [], d1SpecialDates: [], toeicTestDates: [], memo: '',
};

const emptyTimetable: StudentClassTimetableItem = {
  yearMonth: '', title: '', rows: DEFAULT_ROWS, memo: '',
};

function parseDays(value: string) {
  return [...new Set(value.split(/[\s,]+/).map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))].sort((a, b) => a - b);
}

function parseSpecial(value: string, defaultLabel: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [dayText, ...labelParts] = line.split(':');
    return { day: Number(dayText.trim()), label: labelParts.join(':').trim() || defaultLabel };
  }).filter((item) => Number.isInteger(item.day) && item.day >= 1 && item.day <= 31);
}

const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 12px',
  border: '1px solid #cbd5e1', borderRadius: '10px', backgroundColor: 'white', color: '#111827', fontSize: '14px',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '18px',
  padding: '24px', maxWidth: '1100px', marginTop: '22px', color: '#111827',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: '7px', minWidth: 0 }}><span style={{ fontWeight: 700, color: '#334155' }}>{label}</span>{children}</label>;
}

export default function StudentClassScheduleAdmin() {
  const [calendar, setCalendar] = useState<StudentClassCalendarItem>(emptyCalendar);
  const [timetable, setTimetable] = useState<StudentClassTimetableItem>(emptyTimetable);
  const [calendarMessage, setCalendarMessage] = useState('');
  const [timetableMessage, setTimetableMessage] = useState('');
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const resize = () => setIsMobile(window.innerWidth <= 768);
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    fetch('/api/student-class-schedule', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => {
        if (!result.success) return;
        if (result.calendar?.yearMonth) setCalendar({ ...emptyCalendar, ...result.calendar });
        if (result.timetable?.yearMonth) setTimetable({ ...emptyTimetable, ...result.timetable, rows: result.timetable.rows?.length ? result.timetable.rows : DEFAULT_ROWS });
      })
      .catch((error) => console.error('student class schedule admin load error:', error));
  }, []);

  function setYearMonth(value: string) {
    const [year, month] = value.split('-').map(Number);
    setCalendar((current) => ({ ...current, yearMonth: value, year: Number.isInteger(year) ? year : current.year, month: Number.isInteger(month) ? month : current.month }));
  }

  async function saveCalendar(event: FormEvent) {
    event.preventDefault(); setCalendarSaving(true); setCalendarMessage('');
    try {
      const response = await fetch('/api/student-class-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'calendar', item: calendar }) });
      const result = await response.json();
      setCalendarMessage(result.success ? '반별 페이지용 캘린더가 저장되었습니다.' : result.message ?? '저장에 실패했습니다.');
    } catch { setCalendarMessage('캘린더 저장 중 오류가 발생했습니다.'); }
    finally { setCalendarSaving(false); }
  }

  async function saveTimetable(event: FormEvent) {
    event.preventDefault(); setTimetableSaving(true); setTimetableMessage('');
    try {
      const response = await fetch('/api/student-class-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'timetable', item: timetable }) });
      const result = await response.json();
      setTimetableMessage(result.success ? '반별 페이지용 시간표가 저장되었습니다.' : result.message ?? '저장에 실패했습니다.');
    } catch { setTimetableMessage('시간표 저장 중 오류가 발생했습니다.'); }
    finally { setTimetableSaving(false); }
  }

  function updateRow(index: number, patch: Partial<StudentClassTimetableRow>) {
    setTimetable((current) => ({ ...current, rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }));
  }

  return (
    <>
      <form onSubmit={saveCalendar} style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>반별 페이지용 월간 캘린더 관리</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>로그인 메인 캘린더와 별도로 저장되며, 학생 반별 페이지에 표시됩니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '18px' }}>
          <Field label="기준 월"><input type="month" value={calendar.yearMonth} onChange={(e) => setYearMonth(e.target.value)} style={inputStyle} /></Field>
          <Field label="월수반 날짜"><input value={calendar.monWedDates.join(', ')} onChange={(e) => setCalendar((c) => ({ ...c, monWedDates: parseDays(e.target.value) }))} placeholder="1, 3, 8, 10" style={inputStyle} /></Field>
          <Field label="화목반 날짜"><input value={calendar.tueThuDates.join(', ')} onChange={(e) => setCalendar((c) => ({ ...c, tueThuDates: parseDays(e.target.value) }))} placeholder="2, 4, 9, 11" style={inputStyle} /></Field>
          <Field label="600반 추가수업 날짜"><input value={calendar.sixHundredOnlyDates.join(', ')} onChange={(e) => setCalendar((c) => ({ ...c, sixHundredOnlyDates: parseDays(e.target.value) }))} style={inputStyle} /></Field>
          <Field label="토익시험일"><input value={calendar.toeicTestDates.join(', ')} onChange={(e) => setCalendar((c) => ({ ...c, toeicTestDates: parseDays(e.target.value) }))} style={inputStyle} /></Field>
          <Field label="월간데니 날짜"><input value={calendar.monthlyDennyDates.join(', ')} onChange={(e) => setCalendar((c) => ({ ...c, monthlyDennyDates: parseDays(e.target.value) }))} style={inputStyle} /></Field>
          <Field label="D-1특강 (한 줄에 날짜: 문구)"><textarea value={calendar.d1SpecialDates.map((v) => `${v.day}: ${v.label}`).join('\n')} onChange={(e) => setCalendar((c) => ({ ...c, d1SpecialDates: parseSpecial(e.target.value, 'D-1특강') }))} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} /></Field>
          <Field label="기타 특별일정 (한 줄에 날짜: 문구)"><textarea value={calendar.specialDates.map((v) => `${v.day}: ${v.label}`).join('\n')} onChange={(e) => setCalendar((c) => ({ ...c, specialDates: parseSpecial(e.target.value, '특별일정') }))} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} /></Field>
        </div>
        <Field label="캘린더 메모"><textarea value={calendar.memo} onChange={(e) => setCalendar((c) => ({ ...c, memo: e.target.value }))} style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} /></Field>
        <div style={{ margin: '18px 0' }}><button disabled={calendarSaving} style={{ padding: '12px 18px', border: 0, borderRadius: '10px', backgroundColor: '#111827', color: 'white', fontWeight: 700 }}>{calendarSaving ? '저장 중...' : '반별 캘린더 저장'}</button></div>
        {calendarMessage ? <p style={{ color: calendarMessage.includes('저장되었습니다') ? '#0f766e' : '#b91c1c', fontWeight: 700 }}>{calendarMessage}</p> : null}
        {calendar.yearMonth ? <StudentClassCalendar item={calendar} isMobile={isMobile} /> : null}
      </form>

      <form onSubmit={saveTimetable} style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: '24px' }}>반별 페이지용 시간표 관리</h2>
        <p style={{ color: '#64748b', lineHeight: 1.6 }}>로그인 메인 시간표와 별도로 저장되며, 학생 반별 페이지에 표시됩니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
          <Field label="기준 월"><input type="month" value={timetable.yearMonth} onChange={(e) => setTimetable((c) => ({ ...c, yearMonth: e.target.value }))} style={inputStyle} /></Field>
          <Field label="표시 제목"><input value={timetable.title} onChange={(e) => setTimetable((c) => ({ ...c, title: e.target.value }))} placeholder="6 June" style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {timetable.rows.map((row, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
              {(['time', 'class600MonWed', 'class600TueThu', 'class800MonWed', 'class800TueThu'] as const).map((key) => <input key={key} value={row[key]} onChange={(e) => updateRow(index, { [key]: e.target.value })} placeholder={{ time: '시간', class600MonWed: '600 월수', class600TueThu: '600 화목', class800MonWed: '800 월수', class800TueThu: '800 화목' }[key]} style={inputStyle} />)}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '16px' }}><Field label="시간표 메모"><textarea value={timetable.memo} onChange={(e) => setTimetable((c) => ({ ...c, memo: e.target.value }))} style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} /></Field></div>
        <div style={{ margin: '18px 0' }}><button disabled={timetableSaving} style={{ padding: '12px 18px', border: 0, borderRadius: '10px', backgroundColor: '#111827', color: 'white', fontWeight: 700 }}>{timetableSaving ? '저장 중...' : '반별 시간표 저장'}</button></div>
        {timetableMessage ? <p style={{ color: timetableMessage.includes('저장되었습니다') ? '#0f766e' : '#b91c1c', fontWeight: 700 }}>{timetableMessage}</p> : null}
        {timetable.yearMonth ? <StudentClassTimetable item={timetable} isMobile={isMobile} /> : null}
      </form>
    </>
  );
}
