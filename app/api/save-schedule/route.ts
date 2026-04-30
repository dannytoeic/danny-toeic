import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const imageSrc = String(body.imageSrc ?? '').trim();
    const imageAlt = String(body.imageAlt ?? '').trim();

    if (!title) {
      return Response.json(
        { success: false, message: '일정 제목이 비어 있습니다.' },
        { status: 400 }
      );
    }

    if (!imageSrc) {
      return Response.json(
        { success: false, message: '이미지 경로가 비어 있습니다.' },
        { status: 400 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      'app',
      'student',
      'data',
      'schedule.ts'
    );

    const fileContent = `export const monthlySchedule = {
  title: ${JSON.stringify(title)},
  description: ${JSON.stringify(description)},
  imageSrc: ${JSON.stringify(imageSrc)},
  imageAlt: ${JSON.stringify(imageAlt || '한달일정 이미지')},
};
`;

    await writeFile(filePath, fileContent, 'utf-8');

    return Response.json({
      success: true,
      message: '한달일정이 저장되었습니다.',
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { success: false, message: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}