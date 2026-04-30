'use client';

import { FormEvent, useEffect, useState } from 'react';
import AdminShell from '../AdminShell';

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

const DEFAULT_ROWS: TimetableRow[] = [
  { time: '9:30-11:10', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '11:20-12:10', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '12:20-13:10', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '14:30-15:20', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '15:30-16:20', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '17:40-19:20', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '19:30-20:20', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
  { time: '20:30-21:20', class600MonWed: '', class600TueThu: '', class800MonWed: '', class800TueThu: '' },
];

function makeDefaultItem(): MonthlyTimetableItem {
  return {
    yearMonth: '',
    title: '',
    rows: DEFAULT_ROWS,
    memo: '',
  };
}

export default function MonthlyTimetableAdminPage() {
  const [item, setItem] = useState<MonthlyTimetableItem>(makeDefaultItem());
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const monWedFill = '#cbbfb0';
  const eightHundredFill = '#dce8cf';
  const sharedHeaderBg = '#f3f0e8';

  useEffect(() => {
    async function loadItem() {
      setIsLoading(true);
      setMessage('');

      try {
        const response = await fetch('/api/get-monthly-timetable', {
          cache: 'no-store',
        });
        const result = await response.json();

        if (result.success && result.item) {
          setItem({
            yearMonth: result.item.yearMonth ?? '',
            title: result.item.title ?? '',
            rows:
              Array.isArray(result.item.rows) && result.item.rows.length > 0
                ? result.item.rows
                : DEFAULT_ROWS,
            memo: result.item.memo ?? '',
          });
        } else {
          setItem(makeDefaultItem());
        }
      } catch (error) {
        console.error(error);
        setMessage('월간 시간표를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    loadItem();
  }, []);

  function updateRow(index: number, patch: Partial<TimetableRow>) {
    setItem((prev) => ({
      ...prev,
      rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/save-monthly-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      const result = await response.json();

      if (!result.success) {
        setMessage(result.message ?? '저장에 실패했습니다.');
        return;
      }

      setMessage('월간 시간표가 저장되었습니다.');
    } catch (error) {
      console.error(error);
      setMessage('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    boxSizing: 'border-box',
    fontSize: '14px',
    backgroundColor: 'white',
  };

  if (isLoading) {
    return (
      <AdminShell title="월간 시간표 관리" description="월간 시간표를 등록하고 미리보기를 확인합니다.">
        불러오는 중...
      </AdminShell>
    );
  }

  return (
    <AdminShell title="월간 시간표 관리" description="월간 시간표를 등록하고 미리보기를 확인합니다.">
      <div style={{ display: 'grid', gap: '20px' }}>
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            display: 'grid',
            gap: '18px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ marginBottom: '6px', fontWeight: 700 }}>기준 월</div>
              <input
                value={item.yearMonth}
                onChange={(e) => setItem((prev) => ({ ...prev, yearMonth: e.target.value }))}
                placeholder="2026-05"
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ marginBottom: '6px', fontWeight: 700 }}>표시 제목</div>
              <input
                value={item.title}
                onChange={(e) => setItem((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="5 May"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {item.rows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                  gap: '10px',
                }}
              >
                <input
                  value={row.time}
                  onChange={(e) => updateRow(index, { time: e.target.value })}
                  style={inputStyle}
                />
                <input
                  value={row.class600MonWed}
                  onChange={(e) => updateRow(index, { class600MonWed: e.target.value })}
                  placeholder="600 RC A"
                  style={inputStyle}
                />
                <input
                  value={row.class600TueThu}
                  onChange={(e) => updateRow(index, { class600TueThu: e.target.value })}
                  placeholder="600 RC B"
                  style={inputStyle}
                />
                <input
                  value={row.class800MonWed}
                  onChange={(e) => updateRow(index, { class800MonWed: e.target.value })}
                  placeholder="800 RC + LC"
                  style={inputStyle}
                />
                <input
                  value={row.class800TueThu}
                  onChange={(e) => updateRow(index, { class800TueThu: e.target.value })}
                  placeholder="800 RC + LC"
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          <div>
            <div style={{ marginBottom: '6px', fontWeight: 700 }}>오른쪽 메모</div>
            <textarea
              value={item.memo}
              onChange={(e) => setItem((prev) => ({ ...prev, memo: e.target.value }))}
              rows={6}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '12px 18px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: '#111827',
                color: 'white',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>

          {message && (
            <div
              style={{
                color: '#475569',
                fontWeight: 700,
              }}
            >
              {message}
            </div>
          )}
        </form>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.85fr)',
            gap: '24px',
          }}
        >
          <section
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            <div style={{ fontSize: '18px', color: '#78716c', marginBottom: '8px' }}>
              {item.yearMonth ? item.yearMonth.slice(0, 4) : '2026'}
            </div>

            <div
              style={{
                fontSize: '62px',
                fontWeight: 700,
                lineHeight: 1,
                color: '#44403c',
                letterSpacing: '-0.04em',
                marginBottom: '18px',
              }}
            >
              {item.title || '5 May'}
            </div>

            <div
              style={{
                borderRadius: '20px',
                border: '1px solid #e5e7eb',
                overflow: 'hidden',
              }}
            >
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
                        border: '1px solid #d6d3d1',
                        backgroundColor: sharedHeaderBg,
                        padding: '12px 6px',
                      }}
                    />
                    <th
                      colSpan={2}
                      style={{
                        border: '1px solid #d6d3d1',
                        backgroundColor: sharedHeaderBg,
                        padding: '12px 6px',
                        fontSize: '17px',
                        color: '#44403c',
                      }}
                    >
                      600
                    </th>
                    <th
                      colSpan={2}
                      style={{
                        border: '1px solid #d6d3d1',
                        backgroundColor: sharedHeaderBg,
                        padding: '12px 6px',
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
                        backgroundColor: '#fafaf9',
                        padding: '10px 6px',
                      }}
                    />
                    <th
                      style={{
                        border: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                        padding: '10px 6px',
                        fontSize: '14px',
                      }}
                    >
                      월수
                    </th>
                    <th
                      style={{
                        border: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                        padding: '10px 6px',
                        fontSize: '14px',
                      }}
                    >
                      화목
                    </th>
                    <th
                      style={{
                        border: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                        padding: '10px 6px',
                        fontSize: '14px',
                      }}
                    >
                      월수
                    </th>
                    <th
                      style={{
                        border: '1px solid #e5e7eb',
                        backgroundColor: 'white',
                        padding: '10px 6px',
                        fontSize: '14px',
                      }}
                    >
                      화목
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {item.rows.map((row, index) => (
                    <tr key={index}>
                      <td
                        style={{
                          border: '1px solid #e5e7eb',
                          backgroundColor: '#fafaf9',
                          padding: '12px 6px',
                          fontSize: '13px',
                          color: '#57534e',
                        }}
                      >
                        {row.time}
                      </td>

                      <td
                        style={{
                          border: '1px solid #e5e7eb',
                          backgroundColor: row.class600MonWed ? monWedFill : 'white',
                          color: row.class600MonWed ? '#111827' : '#cbd5e1',
                          padding: '12px 6px',
                          fontWeight: row.class600MonWed ? 600 : 400,
                        }}
                      >
                        {row.class600MonWed || ''}
                      </td>

                      <td
                        style={{
                          border: '1px solid #e5e7eb',
                          backgroundColor: row.class600TueThu ? monWedFill : 'white',
                          color: row.class600TueThu ? '#111827' : '#cbd5e1',
                          padding: '12px 6px',
                          fontWeight: row.class600TueThu ? 600 : 400,
                        }}
                      >
                        {row.class600TueThu || ''}
                      </td>

                      <td
                        style={{
                          border: '1px solid #e5e7eb',
                          backgroundColor: row.class800MonWed ? eightHundredFill : 'white',
                          color: row.class800MonWed ? '#111827' : '#cbd5e1',
                          padding: '12px 6px',
                          fontWeight: row.class800MonWed ? 600 : 400,
                        }}
                      >
                        {row.class800MonWed || ''}
                      </td>

                      <td
                        style={{
                          border: '1px solid #e5e7eb',
                          backgroundColor: row.class800TueThu ? eightHundredFill : 'white',
                          color: row.class800TueThu ? '#111827' : '#cbd5e1',
                          padding: '12px 6px',
                          fontWeight: row.class800TueThu ? 600 : 400,
                        }}
                      >
                        {row.class800TueThu || ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section
            style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
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

            <div
              style={{
                border: '1px solid #e7e5e4',
                borderRadius: '16px',
                backgroundColor: '#fafaf9',
                padding: '18px',
                minHeight: '260px',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.8,
                color: '#57534e',
                fontSize: '14px',
              }}
            >
              {item.memo?.trim() ? item.memo : '등록된 메모가 없습니다.'}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}