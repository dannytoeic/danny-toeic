'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoggedInStudent = {
  id: string;
  name: string;
  username?: string;
  classKey?: string;
  classKeys?: string[];
  monthKey?: string;
  expiresAt?: string;
  isActive?: boolean;
};

type LinkRow = {
  title: string;
  url: string;
};

type VideoItem = {
  id?: string;
  role?: 'rc' | 'lc' | 'main' | 'extra';
  url?: string;
};

type AudioItem = {
  id?: string;
  category?: 'class' | 'homework' | 'memorize' | 'extra';
  title?: string;
  url?: string;
};

type ExtraItem = {
  id?: string;
  type?: 'text' | 'image' | 'link';
  text?: string;
  imageUrl?: string;
  linkTitle?: string;
  linkUrl?: string;
};

type StudentApiCard = {
  id: string;
  createdAt: string;
  isPinned?: boolean;
  dayLabel: string;
  dateLabel: string;
  noticeText: string;
  videos?: VideoItem[];
  audios?: AudioItem[];
  extras?: ExtraItem[];
  memoText?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  type?: string;
  materialTitle?: string;
  materialUrl?: string;
  audioTitle?: string;
  audioUrl?: string;
  linkTitle?: string;
  homeworkText?: string;
  audioTitlesText?: string;
  videoUrlsText?: string;
  videoTitlesText?: string;
  extraMaterialTitlesText?: string;
};

type ClassPageData = {
  globalNoticeText: string;
  cards: StudentApiCard[];
};

type ClassUpdatesMap = Record<string, ClassPageData>;

type StudentClassPageProps = {
  classKey: '600-monwed' | '600-tuthu' | '800-monwed' | '800-tuthu';
  title: string;
  description: string;
};

const emptyClassUpdates: ClassUpdatesMap = {
  '600-monwed': { globalNoticeText: '', cards: [] },
  '600-tuthu': { globalNoticeText: '', cards: [] },
  '800-monwed': { globalNoticeText: '', cards: [] },
  '800-tuthu': { globalNoticeText: '', cards: [] },
};

function hasClassAccess(student: LoggedInStudent | null, classKey: string) {
  if (!student) return false;
  if (student.classKey === classKey) return true;
  if (Array.isArray(student.classKeys) && student.classKeys.includes(classKey)) {
    return true;
  }
  return false;
}

function splitLines(text?: string) {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function makeLinkRows(
  titlesText?: string,
  urlsText?: string,
  defaultLabel = '링크'
): LinkRow[] {
  const titles = splitLines(titlesText);
  const urls = splitLines(urlsText);
  const max = Math.max(titles.length, urls.length);

  return Array.from({ length: max }, (_, index) => ({
    title: titles[index] || `${defaultLabel} ${index + 1}`,
    url: urls[index] || '',
  })).filter((row) => row.title || row.url);
}

function makeVideoRows(card: StudentApiCard): LinkRow[] {
  if (Array.isArray(card.videos) && card.videos.length > 0) {
    const rows = card.videos
      .map((video, index) => {
        const role = String(video?.role ?? 'extra');
        const url = String(video?.url ?? '').trim();

        let title = `기타 영상 ${index + 1}`;
        if (role === 'main') title = '수업영상';
        if (role === 'extra') title = `기타 영상 ${index + 1}`;
        if (role === 'rc') title = 'RC 수업영상';
        if (role === 'lc') title = 'LC 수업영상';

        return { title, url };
      })
      .filter((row) => row.url);

    if (rows.length > 0) return rows;
  }

  return makeLinkRows(undefined, card.videoUrlsText, '수업영상');
}

function makeAudioRows(card: StudentApiCard): LinkRow[] {
  if (Array.isArray(card.audios) && card.audios.length > 0) {
    const rows = card.audios
      .map((audio, index) => {
        const category = String(audio?.category ?? 'class');
        const url = String(audio?.url ?? '').trim();
        const rawTitle = String(audio?.title ?? '').trim();

        let title = rawTitle || `음원 ${index + 1}`;
        if (!rawTitle) {
          if (category === 'class') title = `수업음원 ${index + 1}`;
          if (category === 'homework') title = `과제음원 ${index + 1}`;
          if (category === 'memorize') title = `문장암기 ${index + 1}`;
          if (category === 'extra') title = `기타음원 ${index + 1}`;
        }

        return { title, url };
      })
      .filter((row) => row.url);

    if (rows.length > 0) return rows;
  }

  const fallbackRows: LinkRow[] = [];
  const singleTitle = String(card.audioTitle ?? '').trim();
  const singleUrl = String(card.audioUrl ?? '').trim();

  if (singleTitle || singleUrl) {
    fallbackRows.push({
      title: singleTitle || '수업음원 1',
      url: singleUrl,
    });
  }

  return fallbackRows.filter((row) => row.url);
}

function extractExtraText(card: StudentApiCard) {
  const extraTexts =
    Array.isArray(card.extras)
      ? card.extras
          .filter((item) => item?.type === 'text')
          .map((item) => String(item?.text ?? '').trim())
          .filter(Boolean)
      : [];

  if (extraTexts.length > 0) {
    return extraTexts.join('\n\n');
  }

  return String(card.homeworkText ?? '').trim();
}

function extractExtraLinks(card: StudentApiCard): LinkRow[] {
  if (Array.isArray(card.extras) && card.extras.length > 0) {
    const rows = card.extras
      .filter((item) => item?.type === 'link')
      .map((item, index) => ({
        title: String(item?.linkTitle ?? '').trim() || `추가 링크 ${index + 1}`,
        url: String(item?.linkUrl ?? '').trim(),
      }))
      .filter((row) => row.url);

    if (rows.length > 0) return rows;
  }

  const fallbackTitle = String(card.linkTitle ?? '').trim();
  const fallbackUrl = String(card.linkUrl ?? '').trim();

  if (fallbackTitle || fallbackUrl) {
    return [
      {
        title: fallbackTitle || '추가 링크',
        url: fallbackUrl,
      },
    ].filter((row) => row.url);
  }

  return [];
}

function extractExtraImages(card: StudentApiCard): string[] {
  if (!Array.isArray(card.extras)) return [];

  return card.extras
    .filter((item) => item?.type === 'image')
    .map((item) => String(item?.imageUrl ?? '').trim())
    .filter(Boolean);
}

export default function StudentClassPage({
  classKey,
  title,
  description,
}: StudentClassPageProps) {
  const router = useRouter();
  const [student, setStudent] = useState<LoggedInStudent | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [updates, setUpdates] = useState<ClassUpdatesMap>(emptyClassUpdates);
  const [message, setMessage] = useState('수업 카드를 불러오는 중...');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function updateViewport() {
      setIsMobile(window.innerWidth < 768);
    }

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const savedStudent = localStorage.getItem('loggedInStudent');

    if (!savedStudent) {
      router.push('/');
      return;
    }

    try {
      const parsed = JSON.parse(savedStudent) as LoggedInStudent;

      if (!hasClassAccess(parsed, classKey)) {
        router.push('/student');
        return;
      }

      window.setTimeout(() => {
        setStudent(parsed);
        setIsChecking(false);
      }, 0);
    } catch (error) {
      console.error(error);
      localStorage.removeItem('loggedInStudent');
      router.push('/');
    }
  }, [router, classKey]);

  useEffect(() => {
    if (isChecking || !student) return;

    fetch('/api/log-student-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        name: student.name,
        classKey,
        monthKey: student.monthKey ?? '',
        pageKey: `class-${classKey}`,
        pageTitle: `${title} 페이지`,
      }),
    }).catch((error) => {
      console.error('visit log error:', error);
    });
  }, [isChecking, student, classKey, title]);

  useEffect(() => {
    if (isChecking) return;

    async function fetchUpdates() {
      try {
        const response = await fetch(
          `/api/get-class-updates-for-student?classKey=${classKey}`,
          { cache: 'no-store' }
        );
        const result = await response.json();

        if (result.success) {
          setUpdates({
            ...emptyClassUpdates,
            ...(result.updates ?? {}),
          });
          setMessage('');
        } else {
          setMessage(result.message ?? '수업 카드를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error(error);
        setMessage('수업 카드를 불러오는 중 오류가 발생했습니다.');
      }
    }

    fetchUpdates();
  }, [isChecking, classKey]);

  const pageData = updates[classKey];

  const cards = useMemo<StudentApiCard[]>(() => {
    const raw = pageData?.cards ?? [];
    return [...raw].sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;

      if (pinA !== pinB) return pinB - pinA;

      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [pageData]);

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#0b0a09',
    fontFamily: 'Arial, sans-serif',
    color: '#f3eee8',
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1120px',
    margin: '0 auto',
    padding: isMobile ? '18px 12px 40px' : '28px 18px 64px',
  };

  const outerCardStyle: React.CSSProperties = {
    backgroundColor: '#2a201c',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: isMobile ? '16px' : '18px',
    padding: isMobile ? '16px' : '22px',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
  };

  const innerBoxStyle: React.CSSProperties = {
    backgroundColor: '#fbf7f1',
    border: '1px solid #e8ded1',
    borderRadius: isMobile ? '12px' : '14px',
    padding: isMobile ? '16px 16px' : '22px 24px',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  };

  const headerOuterStyle: React.CSSProperties = {
    backgroundColor: '#211815',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: isMobile ? '16px' : '18px',
    padding: isMobile ? '22px 18px' : '36px 30px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
    marginBottom: isMobile ? '18px' : '26px',
  };

  const topButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: isMobile ? '10px 13px' : '11px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.09)',
    backgroundColor: '#16120f',
    color: '#f5efe8',
    textDecoration: 'none',
    fontSize: isMobile ? '13px' : '14px',
    fontWeight: 700,
  };

  const vocaButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    minHeight: isMobile ? '56px' : '58px',
    padding: isMobile ? '15px 16px' : '16px 20px',
    borderRadius: isMobile ? '16px' : '18px',
    backgroundColor: '#f4e7d7',
    color: '#1a1411',
    border: '1px solid rgba(226, 199, 170, 0.75)',
    boxShadow: '0 10px 24px rgba(0, 0, 0, 0.16)',
    textDecoration: 'none',
    fontSize: isMobile ? '17px' : '18px',
    fontWeight: 900,
    boxSizing: 'border-box',
    wordBreak: 'keep-all',
    textAlign: 'center',
  };

  const fixedVocaButtonStyle: React.CSSProperties = {
    position: 'sticky',
    top: isMobile ? '10px' : '16px',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '100%',
    minHeight: isMobile ? '56px' : '54px',
    marginBottom: isMobile ? '14px' : '18px',
    padding: isMobile ? '15px 16px' : '14px 18px',
    borderRadius: isMobile ? '16px' : '18px',
    backgroundColor: '#f4e7d7',
    color: '#1a1411',
    border: '2px solid #e2c7aa',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.26)',
    textDecoration: 'none',
    fontSize: isMobile ? '17px' : '17px',
    fontWeight: 900,
    boxSizing: 'border-box',
    wordBreak: 'keep-all',
    textAlign: 'center',
  };

  const topLabelStyle: React.CSSProperties = {
    color: '#e2c7aa',
    fontSize: isMobile ? '15px' : '18px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    marginBottom: isMobile ? '12px' : '16px',
  };

  const titleTextStyle: React.CSSProperties = {
    margin: 0,
    fontSize: isMobile ? '34px' : '58px',
    lineHeight: isMobile ? 1.12 : 1.05,
    color: '#fffaf5',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    wordBreak: 'keep-all' as const,
  };

  const descriptionStyle: React.CSSProperties = {
    marginTop: isMobile ? '12px' : '16px',
    marginBottom: 0,
    color: '#dccdbd',
    fontSize: isMobile ? '16px' : '22px',
    lineHeight: isMobile ? 1.65 : 1.72,
    maxWidth: '760px',
    whiteSpace: 'pre-line' as const,
    fontWeight: 600,
  };

  const sectionHeaderRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'flex-start' : 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: isMobile ? '14px' : '18px',
    paddingBottom: isMobile ? '10px' : '12px',
    borderBottom: '1px solid rgba(236, 225, 212, 0.18)',
  };

  const sectionHeaderTitleStyle: React.CSSProperties = {
    color: '#f4e7d7',
    fontSize: isMobile ? '22px' : '30px',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.15,
    wordBreak: 'keep-all' as const,
  };

  const sectionDateStyle: React.CSSProperties = {
    color: '#d2b89d',
    fontSize: isMobile ? '15px' : '20px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: isMobile ? '18px' : '22px',
    fontWeight: 800,
    color: '#1a1511',
    marginBottom: isMobile ? '10px' : '12px',
    letterSpacing: '-0.01em',
  };

  const bodyTextStyle: React.CSSProperties = {
    margin: 0,
    color: '#221c17',
    fontSize: isMobile ? '15px' : '18px',
    lineHeight: isMobile ? 1.82 : 1.95,
    whiteSpace: 'pre-line' as const,
    wordBreak: 'keep-all' as const,
  };

  const mutedTextStyle: React.CSSProperties = {
    color: '#6a6057',
    fontSize: isMobile ? '14px' : '16px',
    lineHeight: 1.7,
  };

  const linkRowStyle: React.CSSProperties = {
    padding: isMobile ? '8px 0 10px' : '10px 0 12px',
    borderBottom: '1px solid rgba(34, 28, 23, 0.08)',
  };

  const smallMetaTextStyle: React.CSSProperties = {
    color: '#4e453d',
    fontWeight: 700,
    fontSize: isMobile ? '14px' : '16px',
    marginBottom: '8px',
    lineHeight: 1.5,
    wordBreak: 'keep-all' as const,
  };

  const actionButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: isMobile ? '40px' : '42px',
    width: isMobile ? '100%' : 'auto',
    maxWidth: isMobile ? '220px' : 'none',
    padding: isMobile ? '10px 14px' : '10px 16px',
    backgroundColor: '#1a1411',
    color: '#fffaf5',
    textDecoration: 'none',
    borderRadius: '12px',
    fontSize: isMobile ? '14px' : '15px',
    fontWeight: 700,
    marginTop: '4px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  };

  if (isChecking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0a09',
          fontFamily: 'Arial, sans-serif',
          color: '#f3eee8',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        로그인 상태 확인 중...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <a href="/student/danny-voca" style={fixedVocaButtonStyle}>
          Danny Voca 단어암기
        </a>

        <div
          style={{
            marginBottom: isMobile ? '14px' : '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <Link href="/student" style={topButtonStyle}>
            ← 학생 메인으로
          </Link>

          <a
            href="/student/danny-voca"
            style={{
              ...vocaButtonStyle,
              width: isMobile ? '100%' : 'auto',
              minWidth: isMobile ? '100%' : '240px',
              minHeight: isMobile ? '54px' : '48px',
              marginTop: isMobile ? '2px' : 0,
              padding: isMobile ? '14px 16px' : '12px 18px',
              fontSize: isMobile ? '17px' : '16px',
            }}
          >
            Danny Voca 단어암기
          </a>
        </div>

        <section style={headerOuterStyle}>
          <div style={topLabelStyle}>Danny TOEIC Student Page</div>
          <h1 style={titleTextStyle}>{title}</h1>
          <p style={descriptionStyle}>{description}</p>

          <a
            href="/student/danny-voca"
            style={{
              ...vocaButtonStyle,
              marginTop: isMobile ? '18px' : '24px',
            }}
          >
            Danny Voca 단어암기
          </a>
        </section>

        <section style={{ display: 'grid', gap: isMobile ? '20px' : '28px' }}>
          {message ? (
            <section style={outerCardStyle}>
              <div style={innerBoxStyle}>
                <div style={bodyTextStyle}>{message}</div>
              </div>
            </section>
          ) : null}

          <section style={outerCardStyle}>
            <div style={sectionHeaderRowStyle}>
              <div style={sectionHeaderTitleStyle}>전체공지</div>
            </div>

            <div style={innerBoxStyle}>
              {pageData?.globalNoticeText ? (
                <p style={bodyTextStyle}>{pageData.globalNoticeText}</p>
              ) : (
                <div style={mutedTextStyle}>등록된 전체공지가 없습니다.</div>
              )}
            </div>
          </section>

          {cards.length === 0 ? (
            <section style={outerCardStyle}>
              <div style={innerBoxStyle}>
                <div style={mutedTextStyle}>등록된 하루치 수업 카드가 없습니다.</div>
              </div>
            </section>
          ) : (
            cards.map((card) => {
              const videoRows = makeVideoRows(card);
              const audioRows = makeAudioRows(card);
              const extraText = extractExtraText(card);
              const extraLinks = extractExtraLinks(card);
              const extraImages = extractExtraImages(card);

              return (
                <section key={card.id} style={outerCardStyle}>
                  <div style={sectionHeaderRowStyle}>
                    <div style={sectionHeaderTitleStyle}>
                      {card.dayLabel || '하루치 수업 카드'}
                    </div>
                    {card.dateLabel ? (
                      <div style={sectionDateStyle}>{card.dateLabel}</div>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: isMobile ? '14px' : '18px' }}>
                    <div style={innerBoxStyle}>
                      <div style={sectionTitleStyle}>오늘 공지</div>
                      {card.noticeText ? (
                        <p style={bodyTextStyle}>{card.noticeText}</p>
                      ) : (
                        <div style={mutedTextStyle}>등록된 공지가 없습니다.</div>
                      )}
                    </div>

                    {videoRows.length > 0 ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>오늘 수업영상</div>
                        <div>
                          {videoRows.map((row, index) => (
                            <div
                              key={`${row.url}-${index}`}
                              style={{
                                ...linkRowStyle,
                                marginBottom: index === videoRows.length - 1 ? 0 : 2,
                                borderBottom:
                                  index === videoRows.length - 1
                                    ? 'none'
                                    : '1px solid rgba(34, 28, 23, 0.08)',
                              }}
                            >
                              <div style={smallMetaTextStyle}>{row.title}</div>
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                style={actionButtonStyle}
                              >
                                영상 열기
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {audioRows.length > 0 ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>수업음원</div>
                        <div>
                          {audioRows.map((row, index) => (
                            <div
                              key={`${row.url}-${index}`}
                              style={{
                                ...linkRowStyle,
                                marginBottom: index === audioRows.length - 1 ? 0 : 2,
                                borderBottom:
                                  index === audioRows.length - 1
                                    ? 'none'
                                    : '1px solid rgba(34, 28, 23, 0.08)',
                              }}
                            >
                              <div style={smallMetaTextStyle}>{row.title}</div>
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                style={actionButtonStyle}
                              >
                                음원 열기
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {extraText ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>별도 / 추가 공지</div>
                        <p style={bodyTextStyle}>{extraText}</p>
                      </div>
                    ) : null}

                    {extraLinks.length > 0 ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>추가 링크</div>
                        <div>
                          {extraLinks.map((row, index) => (
                            <div
                              key={`${row.url}-${index}`}
                              style={{
                                ...linkRowStyle,
                                marginBottom: index === extraLinks.length - 1 ? 0 : 2,
                                borderBottom:
                                  index === extraLinks.length - 1
                                    ? 'none'
                                    : '1px solid rgba(34, 28, 23, 0.08)',
                              }}
                            >
                              <div style={smallMetaTextStyle}>{row.title}</div>
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noreferrer"
                                style={actionButtonStyle}
                              >
                                링크 열기
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {extraImages.length > 0 ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>추가 이미지</div>
                        <div style={{ display: 'grid', gap: isMobile ? '10px' : '14px' }}>
                          {extraImages.map((src, index) => (
                            <img
                              key={`${src}-${index}`}
                              src={src}
                              alt={`추가 이미지 ${index + 1}`}
                              style={{
                                width: '100%',
                                display: 'block',
                                borderRadius: '12px',
                                border: '1px solid #e2dacf',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {card.memoText ? (
                      <div style={innerBoxStyle}>
                        <div style={sectionTitleStyle}>메모</div>
                        <p style={bodyTextStyle}>{card.memoText}</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
