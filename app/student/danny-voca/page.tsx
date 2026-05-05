'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VocaStudyApp from '@/components/voca/VocaStudyApp';

type LoggedInStudent = {
  classKey?: string;
  classKeys?: string[];
  classGroup?: string;
  course?: string;
  track?: string;
  vocaTrack?: string;
  vocaVersion?: string;
};

export default function StudentDannyVocaPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [student, setStudent] = useState<LoggedInStudent | null>(null);

  useEffect(() => {
    const savedStudent = localStorage.getItem('loggedInStudent');

    if (!savedStudent) {
      router.push('/');
      return;
    }

    try {
      const parsed = JSON.parse(savedStudent) as LoggedInStudent;
      window.setTimeout(() => {
        setStudent(parsed);
        setIsChecking(false);
      }, 0);
    } catch (error) {
      console.error(error);
      localStorage.removeItem('loggedInStudent');
      router.push('/');
    }
  }, [router]);

  if (isChecking) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050C18',
          fontFamily: 'Arial, sans-serif',
          color: '#F4F4F2',
        }}
      >
        로그인 상태 확인 중...
      </main>
    );
  }

  return <VocaStudyApp student={student} />;
}
