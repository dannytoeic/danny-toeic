import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

const logFilePath = path.join(process.cwd(), 'storage', 'studentVisitLogs.json');

async function ensureLogFile() {
  const dirPath = path.dirname(logFilePath);
  await mkdir(dirPath, { recursive: true });

  try {
    await readFile(logFilePath, 'utf-8');
  } catch {
    await writeFile(logFilePath, '[]', 'utf-8');
  }
}

export async function POST(request: Request) {
  try {
    await ensureLogFile();

    const body = await request.json();

    const studentId = String(body.studentId ?? '').trim();
    const name = String(body.name ?? '').trim();
    const classKey = String(body.classKey ?? '').trim();
    const monthKey = String(body.monthKey ?? '').trim();
    const pageKey = String(body.pageKey ?? '').trim();
    const pageTitle = String(body.pageTitle ?? '').trim();

    if (!studentId || !name || !classKey || !monthKey || !pageKey) {
      return Response.json(
        { success: false, message: '열람 로그 정보가 부족합니다.' },
        { status: 400 }
      );
    }

    const fileText = await readFile(logFilePath, 'utf-8');
    const currentLogs = JSON.parse(fileText) as Array<{
      id: string;
      studentId: string;
      name: string;
      classKey: string;
      monthKey: string;
      pageKey: string;
      pageTitle: string;
      visitedAt: string;
    }>;

    const newLog = {
      id: `visit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      studentId,
      name,
      classKey,
      monthKey,
      pageKey,
      pageTitle,
      visitedAt: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...currentLogs].slice(0, 3000);

    await writeFile(logFilePath, JSON.stringify(updatedLogs, null, 2), 'utf-8');

    return Response.json({
      success: true,
      message: '열람 로그가 저장되었습니다.',
    });
  } catch (error) {
    console.error('log-student-visit error:', error);

    return Response.json(
      { success: false, message: '열람 로그 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}