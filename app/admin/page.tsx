'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminShell from './AdminShell';
import { getLoggedInAdmin } from './adminGuard';

type MenuItem = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const PRIMARY_ITEMS: MenuItem[] = [
  {
    title: '반별 수업자료 관리',
    description: '전체공지와 하루치 수업 카드, 음원, 수업영상, 기타자료를 관리합니다.',
    href: '/admin/class-updates',
    badge: '핵심',
  },
  {
    title: '월간 캘린더 관리',
    description: '월수반 수업일, 화목반 수업일, 특강 날짜와 메모를 관리합니다.',
    href: '/admin/monthly-calendar',
  },
  {
    title: '월간 시간표 관리',
    description: '월별 시간표 표와 오른쪽 메모를 관리합니다.',
    href: '/admin/monthly-timetable',
  },
  {
    title: 'Danny Voca 관리',
    description: 'Word 단어시험지를 업로드해 단어암기 카드 시제품으로 변환합니다.',
    href: '/admin/danny-voca',
    badge: '신규',
  },
];

const SECONDARY_ITEMS: MenuItem[] = [
  {
    title: '전체공지 관리',
    description: '학생 전체에게 공통으로 보여줄 공지를 관리합니다.',
    href: '/admin/notices',
  },
  {
    title: '학생 계정 관리',
    description: '학생 계정, 만료일, 활성 여부를 확인하고 수정합니다.',
    href: '/admin/student-accounts',
  },
  {
    title: '회원가입 신청 관리',
    description: '학생이 제출한 회원가입 신청을 확인하고 승인합니다.',
    href: '/admin/signup-requests',
  },
  {
    title: '학생 열람 로그',
    description: '학생들의 접속 및 자료 열람 기록을 확인합니다.',
    href: '/admin/visit-logs',
  },
  {
    title: '배포 전 점검',
    description: '실제 배포 전에 확인할 항목들을 점검합니다.',
    href: '/admin/debug-class-updates',
  },
];

function MenuCard({
  item,
  featured = false,
}: {
  item: MenuItem;
  featured?: boolean;
}) {
  return (
    <Link
      href={item.href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: featured ? '1px solid #d6d3d1' : '1px solid #e5e7eb',
          borderRadius: '18px',
          padding: featured ? '24px 24px' : '22px 22px',
          boxShadow: featured
            ? '0 10px 24px rgba(15, 23, 42, 0.06)'
            : '0 6px 16px rgba(15, 23, 42, 0.04)',
          minHeight: featured ? '150px' : '138px',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              fontSize: featured ? '24px' : '22px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#111827',
              lineHeight: 1.2,
            }}
          >
            {item.title}
          </div>

          {item.badge ? (
            <div
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                backgroundColor: '#111827',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              {item.badge}
            </div>
          ) : null}
        </div>

        <div
          style={{
            color: '#6b7280',
            fontSize: '15px',
            lineHeight: 1.7,
          }}
        >
          {item.description}
        </div>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    const admin = getLoggedInAdmin();
    if (!admin) {
      router.push('/admin/login');
    }
  }, [router]);

  return (
    <AdminShell
      title="관리자 페이지"
      description="운영 메뉴를 선택해 공지, 시간표, 수업자료, 학생 계정과 가입 신청을 관리하세요."
    >
      <div style={{ display: 'grid', gap: '22px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '18px',
          }}
        >
          {PRIMARY_ITEMS.map((item) => (
            <MenuCard key={item.href} item={item} featured />
          ))}
        </section>

        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '20px',
            padding: '22px',
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#111827',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
            }}
          >
            기타 운영 메뉴
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
            }}
          >
            {SECONDARY_ITEMS.map((item) => (
              <MenuCard key={item.href} item={item} />
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
