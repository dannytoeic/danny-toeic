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

export async function GET() {
  try {
    await ensureLogFile();

    const fileText = await readFile(logFilePath, 'utf-8');
    const logs = JSON.parse(fileText);

    return Response.json({
      success: true,
      logs,
    });
  } catch (error) {
    console.error('get-student-visit-logs error:', error);

    return Response.json(
      { success: false, message: '열람 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}