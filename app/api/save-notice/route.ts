import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = String(body.title ?? '').trim();
    const contentText = String(body.contentText ?? '').trim();

    if (!title) {
      return Response.json(
        { success: false, message: '공지 제목이 비어 있습니다.' },
        { status: 400 }
      );
    }

    const contentLines = contentText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

    const filePath = path.join(
      process.cwd(),
      'app',
      'student',
      'data',
      'notice.ts'
    );

    const fileContent = `export const latestNotice = {
  title: ${JSON.stringify(title)},
  content: ${JSON.stringify(contentLines, null, 2)},
};
`;

    await writeFile(filePath, fileContent, 'utf-8');

    return Response.json({
      success: true,
      message: '공지사항이 저장되었습니다.',
    });
  } catch (error) {
    console.error('save-notice error:', error);

    return Response.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}