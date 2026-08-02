import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import {
  fetchFallbackStudentMonthPermissions,
  getPermissionMapForOwner,
} from '../../../lib/student-month-permissions';
import { buildStudentBoardLinks } from '../../../lib/student-board-visibility';

type StudentRow = {
  student_id: string | null;
  username: string;
  is_active: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const username = String(request.nextUrl.searchParams.get('username') ?? '').trim();
    const studentId = String(request.nextUrl.searchParams.get('studentId') ?? '').trim();

    if (!username && !studentId) {
      return NextResponse.json(
        { success: false, message: 'Student identity is required.' },
        { status: 400 }
      );
    }

    const query = supabaseAdmin
      .from('student_accounts')
      .select('student_id, username, is_active');
    const result = username
      ? await query.eq('username', username).maybeSingle()
      : await query.eq('student_id', studentId).maybeSingle();

    if (result.error) {
      console.error('get-student-boards student select error:', result.error);
      return NextResponse.json(
        { success: false, message: 'Student access could not be checked.' },
        { status: 500 }
      );
    }

    const student = result.data as StudentRow | null;
    if (!student || !student.is_active) {
      return NextResponse.json(
        { success: false, message: 'Student account is not available.' },
        { status: 403 }
      );
    }

    const permissions = await fetchFallbackStudentMonthPermissions();
    if (permissions.error) {
      console.error('get-student-boards permissions error:', permissions.error);
      return NextResponse.json(
        { success: false, message: 'Student access could not be checked.' },
        { status: 500 }
      );
    }

    const classKeysByMonth = getPermissionMapForOwner(
      { studentId: student.student_id, username: student.username },
      permissions
    );

    return NextResponse.json({
      success: true,
      boards: buildStudentBoardLinks(classKeysByMonth),
    });
  } catch (error) {
    console.error('get-student-boards catch error:', error);
    return NextResponse.json(
      { success: false, message: 'Student boards could not be loaded.' },
      { status: 500 }
    );
  }
}
