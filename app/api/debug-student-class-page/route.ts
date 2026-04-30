import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

async function tryReadText(relativePath: string) {
  try {
    const filePath = path.join(process.cwd(), relativePath);
    const raw = await fs.readFile(filePath, 'utf-8');

    return {
      target: relativePath,
      exists: true,
      filePath,
      preview: raw.slice(0, 5000),
    };
  } catch {
    return {
      target: relativePath,
      exists: false,
      filePath: path.join(process.cwd(), relativePath),
    };
  }
}

export async function GET() {
  const targets = [
    'app/student/data/classUpdates.ts',
    'app/student/class-600-monwed/page.tsx',
    'app/student/class-600-tuthu/page.tsx',
    'app/student/class-800-monwed/page.tsx',
    'app/student/class-800-tuthu/page.tsx',
  ];

  const results = [];
  for (const target of targets) {
    results.push(await tryReadText(target));
  }

  return NextResponse.json({
    success: true,
    results,
  });
}