import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { OPERATING_YEAR_MONTH } from '../../../lib/operating-month';
import {
  fetchStudentMonthPermissions,
  getPermissionMapForOwner,
  isMissingClassKeysByMonthColumnError,
  normalizeClassKeysByMonth,
  upsertStudentMonthPermissions,
} from '../../../lib/student-month-permissions';
import {
  accessRangeKey,
  fetchStudentClassAccessRanges,
  upsertStudentClassAccessRanges,
} from '../../../lib/student-class-access-ranges';

type StudentClassAccessRangeItem = {
  startCardId?: string | null;
  startOrder?: number | null;
};

type StudentAccountItem = {
  studentId: string;
  id: string;
  username?: string;
  name: string;
  password: string;
  contact?: string;
  classKey?: string;
  classKeys?: string[];
  classKeysByMonth?: Record<string, string[]>;
  classAccessRanges?: Record<string, Record<string, StudentClassAccessRangeItem>>;
  monthKey: string;
  expiresAt: string;
  isActive: boolean;
  createdAt?: string;
};

type StudentAccountRow = {
  student_id: string | null;
  username: string;
  password: string;
  name: string;
  contact: string | null;
  class_key: string | null;
  class_keys: string[] | null;
  class_keys_by_month?: Record<string, string[]> | null;
  month_key: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string | null;
};

type NormalizedStudentAccountRow = {
  student_id: string;
  username: string;
  password: string;
  name: string;
  contact: string;
  class_key: string;
  class_keys: string[];
  class_keys_by_month: Record<string, string[]>;
  month_key: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function normalizeClassKeys(item: {
  classKey?: string | null;
  classKeys?: string[] | null;
}): string[] {
  if (Array.isArray(item.classKeys) && item.classKeys.length > 0) {
    return item.classKeys.filter(Boolean);
  }

  if (item.classKey) {
    return [item.classKey];
  }

  return [];
}

function normalizeClassAccessRanges(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, Record<string, StudentClassAccessRangeItem>>;
  }

  return Object.entries(value as Record<string, unknown>).reduce<
    Record<string, Record<string, StudentClassAccessRangeItem>>
  >((acc, [yearMonth, classMap]) => {
    if (!classMap || typeof classMap !== 'object' || Array.isArray(classMap)) {
      return acc;
    }

    const monthKey = String(yearMonth ?? '').trim();
    if (!monthKey) return acc;

    const ranges = Object.entries(classMap as Record<string, unknown>).reduce<
      Record<string, StudentClassAccessRangeItem>
    >((classAcc, [classKey, rawRange]) => {
      if (!rawRange || typeof rawRange !== 'object' || Array.isArray(rawRange)) {
        return classAcc;
      }

      const range = rawRange as Record<string, unknown>;
      const normalizedClassKey = String(classKey ?? '').trim();
      if (!normalizedClassKey) return classAcc;

      classAcc[normalizedClassKey] = {
        startCardId: String(range.startCardId ?? '').trim() || null,
        startOrder: Number.isFinite(Number(range.startOrder))
          ? Number(range.startOrder)
          : null,
      };

      return classAcc;
    }, {});

    acc[monthKey] = ranges;
    return acc;
  }, {});
}

function mapRowToItem(
  row: StudentAccountRow,
  permissionRows: Awaited<ReturnType<typeof fetchStudentMonthPermissions>>,
  accessRanges: Awaited<ReturnType<typeof fetchStudentClassAccessRanges>>
): StudentAccountItem {
  const classKeys = normalizeClassKeys({
    classKey: row.class_key,
    classKeys: row.class_keys,
  });
  const columnClassKeysByMonth = normalizeClassKeysByMonth(row.class_keys_by_month);
  const tableClassKeysByMonth = getPermissionMapForOwner(
    { studentId: row.student_id, username: row.username },
    permissionRows
  );
  const legacyMonthKey = row.month_key || '';
  const legacyClassKeysByMonth =
    legacyMonthKey && legacyMonthKey !== OPERATING_YEAR_MONTH && classKeys.length > 0
      ? { [legacyMonthKey]: classKeys }
      : {};
  const effectiveClassKeysByMonth =
    Object.keys(tableClassKeysByMonth).length > 0
      ? { ...columnClassKeysByMonth, ...tableClassKeysByMonth }
      : Object.keys(columnClassKeysByMonth).length > 0
      ? columnClassKeysByMonth
      : legacyClassKeysByMonth;

  const studentId = row.student_id || '';

  return {
    studentId,
    id: row.username,
    username: row.username,
    name: row.name,
    password: row.password,
    contact: row.contact || '',
    classKey: row.class_key || classKeys[0] || '',
    classKeys,
    classKeysByMonth: effectiveClassKeysByMonth,
    classAccessRanges: Object.entries(effectiveClassKeysByMonth).reduce<
      Record<string, Record<string, StudentClassAccessRangeItem>>
    >((acc, [yearMonth, classKeysForMonth]) => {
      acc[yearMonth] = {};

      for (const classKey of classKeysForMonth) {
        const range = accessRanges.byKey.get(accessRangeKey(studentId, yearMonth, classKey));
        acc[yearMonth][classKey] = {
          startCardId: range?.startCardId ?? null,
          startOrder: range?.startOrder ?? null,
        };
      }

      return acc;
    }, {}),
    monthKey: legacyMonthKey,
    expiresAt: row.expires_at || '',
    isActive: row.is_active,
    createdAt: row.created_at || '',
  };
}

export async function GET() {
  try {
    const permissionRows = await fetchStudentMonthPermissions();
    if (permissionRows.error) {
      console.error('student_month_permissions GET error:', permissionRows.error);
    }
    const accessRanges = await fetchStudentClassAccessRanges();
    if (accessRanges.error) {
      console.error('student_class_access_ranges GET error:', accessRanges.error);
    }

    let { data, error } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, class_keys_by_month, month_key, expires_at, is_active, created_at'
      )
      .order('created_at', { ascending: false });

    if (isMissingClassKeysByMonthColumnError(error)) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select(
          'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active, created_at'
        )
        .order('created_at', { ascending: false });

      data = legacyResult.data as typeof data;
      error = legacyResult.error;
    }

    if (error) {
      console.error('save-student-accounts GET error:', error);

      return NextResponse.json(
        { success: false, message: '학생 계정을 불러오지 못했습니다.' },
        { status: 500 }
      );
    }

    const items = Array.isArray(data)
      ? (data as StudentAccountRow[]).map((row) =>
          mapRowToItem(row, permissionRows, accessRanges)
        )
      : [];

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('save-student-accounts GET catch error:', error);

    return NextResponse.json(
      { success: false, message: '학생 계정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: StudentAccountItem[] = Array.isArray(body?.items) ? body.items : [];
    const debugPayload = items.map((item) => ({
      username: item.username ?? item.id,
      studentId: item.studentId,
      classKeysByMonth: normalizeClassKeysByMonth(item.classKeysByMonth),
      classAccessRanges: normalizeClassAccessRanges(item.classAccessRanges),
    }));
    console.log('save-student-accounts monthly payload:', JSON.stringify(debugPayload));

    const normalized: NormalizedStudentAccountRow[] = items.reduce<
      NormalizedStudentAccountRow[]
    >((acc, item, index) => {
      const classKeys = normalizeClassKeys({
        classKey: item.classKey,
        classKeys: item.classKeys ?? [],
      });
      const classKeysByMonth = normalizeClassKeysByMonth(item.classKeysByMonth);
      if (classKeys.length > 0 && Object.keys(classKeysByMonth).length === 0) {
        const monthKey = String(item.monthKey ?? '').trim();
        if (monthKey && monthKey !== OPERATING_YEAR_MONTH) {
          classKeysByMonth[monthKey] = classKeys;
        }
      }
      const representativeClassKey = String(item.classKey ?? '').trim();

      const username = String(item.username ?? item.id ?? '').trim();

      if (!username) {
        return acc;
      }

      acc.push({
        student_id:
          String(item.studentId ?? '').trim() || `stu${String(index + 1).padStart(3, '0')}`,
        username,
        password: String(item.password ?? '').trim(),
        name: String(item.name ?? '').trim(),
        contact: String(item.contact ?? '').trim(),
        class_key: representativeClassKey || classKeys[0] || '',
        class_keys: classKeys,
        class_keys_by_month: classKeysByMonth,
        month_key: String(item.monthKey ?? '').trim() || OPERATING_YEAR_MONTH,
        expires_at: String(item.expiresAt ?? '').trim() || null,
        is_active: Boolean(item.isActive),
        created_at: String(item.createdAt ?? '').trim() || new Date().toISOString(),
      });

      return acc;
    }, []);

    const monthlyStorageRequired = normalized.some(
      (row) => Object.keys(row.class_keys_by_month).length > 0
    );
    const permissionStorageProbe = await fetchStudentMonthPermissions();
    const columnProbe = await supabaseAdmin
      .from('student_accounts')
      .select('class_keys_by_month')
      .limit(1);
    const columnAvailableBeforeSave = !isMissingClassKeysByMonthColumnError(columnProbe.error);

    if (permissionStorageProbe.error || (columnProbe.error && columnAvailableBeforeSave)) {
      console.error('monthly permission storage probe error:', {
        tableError: permissionStorageProbe.error,
        columnError: columnProbe.error,
      });

      return NextResponse.json(
        { success: false, message: 'Monthly student permissions storage could not be checked.' },
        { status: 500 }
      );
    }

    if (
      monthlyStorageRequired &&
      !permissionStorageProbe.available &&
      !columnAvailableBeforeSave
    ) {
      console.error('monthly permission storage missing before save:', {
        monthlyStorageRequired,
        tableAvailable: permissionStorageProbe.available,
        columnAvailable: columnAvailableBeforeSave,
      });

      return NextResponse.json(
        {
          success: false,
          message:
            'Monthly student permissions storage is missing. Run the Supabase migration first.',
        },
        { status: 500 }
      );
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('student_accounts')
      .select('username');

    if (existingError) {
      console.error('save-student-accounts existing select error:', existingError);

      return NextResponse.json(
        { success: false, message: '학생 계정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const existingUsernames = Array.isArray(existingRows)
      ? existingRows.map((row) => String(row.username))
      : [];

    const nextUsernames = normalized.map((row) => String(row.username));

    if (normalized.length > 0) {
      let { error: upsertError } = await supabaseAdmin
        .from('student_accounts')
        .upsert(normalized, { onConflict: 'username' });

      let columnAvailable = columnAvailableBeforeSave;
      if (isMissingClassKeysByMonthColumnError(upsertError)) {
        columnAvailable = false;
        const legacyRows = normalized.map(({ class_keys_by_month, ...row }) => row);
        const legacyResult = await supabaseAdmin
          .from('student_accounts')
          .upsert(legacyRows, { onConflict: 'username' });

        upsertError = legacyResult.error;
      }

      if (upsertError) {
        console.error('save-student-accounts upsert error:', upsertError);

        return NextResponse.json(
          { success: false, message: '학생 계정 저장에 실패했습니다.' },
          { status: 500 }
        );
      }

      const permissionWrite = await upsertStudentMonthPermissions(
        normalized.map((row) => ({
          studentId: row.student_id,
          username: row.username,
          classKeysByMonth: row.class_keys_by_month,
        }))
      );

      console.log(
        'save-student-accounts monthly write result:',
        JSON.stringify({
          tableAvailable: permissionWrite.available,
          rowsWritten: permissionWrite.rowsWritten,
          columnAvailable,
          error: permissionWrite.error,
        })
      );

      if (permissionWrite.error) {
        console.error('student_month_permissions upsert error:', permissionWrite.error);

        return NextResponse.json(
          { success: false, message: 'Monthly student permissions could not be saved.' },
          { status: 500 }
        );
      }

      if (!permissionWrite.available && !columnAvailable) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Monthly student permissions storage is missing. Run the Supabase migration first.',
          },
          { status: 500 }
        );
      }

      const accessRangeRows = items.flatMap((item, index) => {
        const studentId =
          String(item.studentId ?? '').trim() || `stu${String(index + 1).padStart(3, '0')}`;
        const classKeysByMonth = normalizeClassKeysByMonth(item.classKeysByMonth);
        const classAccessRanges = normalizeClassAccessRanges(item.classAccessRanges);

        return Object.entries(classKeysByMonth).flatMap(([yearMonth, classKeys]) =>
          classKeys.map((classKey) => {
            const range = classAccessRanges[yearMonth]?.[classKey] ?? {};

            return {
              studentId,
              yearMonth,
              classKey,
              startCardId: range.startCardId ?? null,
              startOrder: range.startOrder ?? null,
            };
          })
        );
      });
      const accessRangeWrite = await upsertStudentClassAccessRanges(accessRangeRows);

      if (accessRangeWrite.error) {
        console.error('student_class_access_ranges upsert error:', accessRangeWrite.error);

        return NextResponse.json(
          { success: false, message: 'Student class access ranges could not be saved.' },
          { status: 500 }
        );
      }

      const hasRestrictedRange = accessRangeRows.some((range) => range.startCardId);
      if (hasRestrictedRange && !accessRangeWrite.available) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Student class access range storage is missing. Run the Supabase migration first.',
          },
          { status: 500 }
        );
      }
    }

    const usernamesToDelete = existingUsernames.filter(
      (username) => !nextUsernames.includes(username)
    );

    if (usernamesToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('student_accounts')
        .delete()
        .in('username', usernamesToDelete);

      if (deleteError) {
        console.error('save-student-accounts delete error:', deleteError);

        return NextResponse.json(
          { success: false, message: '학생 계정 저장에 실패했습니다.' },
          { status: 500 }
        );
      }
    }

    let { data: finalRows, error: finalError } = await supabaseAdmin
      .from('student_accounts')
      .select(
        'student_id, username, password, name, contact, class_key, class_keys, class_keys_by_month, month_key, expires_at, is_active, created_at'
      )
      .order('created_at', { ascending: false });

    if (isMissingClassKeysByMonthColumnError(finalError)) {
      const legacyResult = await supabaseAdmin
        .from('student_accounts')
        .select(
          'student_id, username, password, name, contact, class_key, class_keys, month_key, expires_at, is_active, created_at'
        )
        .order('created_at', { ascending: false });

      finalRows = legacyResult.data as typeof finalRows;
      finalError = legacyResult.error;
    }

    if (finalError) {
      console.error('save-student-accounts final select error:', finalError);

      return NextResponse.json(
        { success: false, message: '학생 계정 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const finalPermissionRows = await fetchStudentMonthPermissions();
    if (finalPermissionRows.error) {
      console.error('student_month_permissions final GET error:', finalPermissionRows.error);
    }
    const finalAccessRanges = await fetchStudentClassAccessRanges();
    if (finalAccessRanges.error) {
      console.error('student_class_access_ranges final GET error:', finalAccessRanges.error);
    }

    const finalItems = Array.isArray(finalRows)
      ? (finalRows as StudentAccountRow[]).map((row) =>
          mapRowToItem(row, finalPermissionRows, finalAccessRanges)
        )
      : [];

    return NextResponse.json({
      success: true,
      items: finalItems,
    });
  } catch (error) {
    console.error('save-student-accounts POST catch error:', error);

    return NextResponse.json(
      { success: false, message: '학생 계정 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}
