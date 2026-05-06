import type {
  VocaCourse,
  VocaDay,
  VocaProgressMap,
  VocaSet,
  VocaTrack,
  VocaVersion,
} from './types';

const VOCA_SET_IDS_KEY = 'dannyVoca.setIds';
const VOCA_PROGRESS_KEY = 'dannyVoca.progress';
const LEGACY_VOCA_SET_KEY = 'dannyVoca.latestSet';

export const VOCA_COURSES: VocaCourse[] = ['600', '800'];
export const VOCA_TRACKS: VocaTrack[] = ['A', 'B'];
export const VOCA_DAYS: VocaDay[] = [
  'Day 1',
  'Day 2',
  'Day 3',
  'Day 4',
  'Day 5',
  'Day 6',
  'Day 7',
  'Day 8',
  'Day 9',
  'Day 10',
];

export function getVersionsForCourse(course: VocaCourse): VocaVersion[] {
  return course === '600' ? ['통합'] : ['ver.3'];
}

function normalizeVersionForCourse(course: VocaCourse, version: VocaVersion): VocaVersion {
  return course === '600' ? '통합' : version;
}

function getVersionSortIndex(version: VocaVersion) {
  const versionOrder: VocaVersion[] = ['통합', 'ver.3', 'ver.2', 'ver.1'];
  const index = versionOrder.indexOf(version);
  return index === -1 ? versionOrder.length : index;
}

export function makeVocaSetId(
  course: VocaCourse,
  track: VocaTrack,
  version: VocaVersion,
  day: VocaDay
) {
  const normalizedVersion = normalizeVersionForCourse(course, version);
  const versionKey = normalizedVersion === '통합' ? 'unified' : normalizedVersion;
  return `danny-voca-set-${course}-${track}-${versionKey}-${day.replace(/\s+/g, '')}`;
}

export function makeVocaDisplayTitle(
  course: VocaCourse,
  track: VocaTrack,
  version: VocaVersion,
  day: VocaDay
) {
  const normalizedVersion = normalizeVersionForCourse(course, version);
  return normalizedVersion === '통합'
    ? `${course}반 ${track} ${day}`
    : `${course}반 ${track} ${normalizedVersion} ${day}`;
}

function makeSetStorageKey(id: string) {
  return id;
}

export const sampleVocaSet: VocaSet = {
  id: 'sample-danny-voca-800-A-ver.3-Day1',
  title: '800반 A ver.3 Day 1',
  displayTitle: '800반 A ver.3 Day 1',
  course: '800',
  track: 'A',
  book: '시제품 샘플',
  version: 'ver.3',
  day: 'Day 1',
  items: [
    {
      id: 'sample-800-A-ver3-day1-001',
      type: 'group',
      originalText: 'synthetic material (명) (합성물질)',
      quizText: 'synthetic material ____ ____',
      answers: ['명', '합성물질'],
      rawText: 'synthetic material (명) (합성물질)',
      speakable: true,
    },
    {
      id: 'sample-800-A-ver3-day1-002',
      type: 'group',
      originalText: 'way (to V) ~할 방법\nto부정사의 수식을 받는 명사정리\n(plan/place/right/reason/opportunity/chance/way/\nability/time) + to V',
      quizText: 'way ____ ~할 방법\nto부정사의 수식을 받는 명사정리\n____\n____ + to V',
      answers: ['to V', 'plan/place/right/reason/opportunity/chance/way/\nability/time'],
      rawText: 'way (to V) ~할 방법\nto부정사의 수식을 받는 명사정리\n(plan/place/right/reason/opportunity/chance/way/\nability/time) + to V',
      lines: [
        'way (to V) ~할 방법',
        'to부정사의 수식을 받는 명사정리',
        '(plan/place/right/reason/opportunity/chance/way/',
        'ability/time) + to V',
      ],
      speakable: false,
    },
    {
      id: 'sample-800-A-ver3-day1-003',
      type: 'group',
      originalText: '(hopeful)/(doubtful)/(optimistic) that절\n~에 대해 (희망적인)/회의적인/(낙관적인)',
      quizText: '____/____/____ that절\n~에 대해 ____/회의적인/____',
      answers: ['hopeful', 'doubtful', 'optimistic', '희망적인', '낙관적인'],
      rawText: '(hopeful)/(doubtful)/(optimistic) that절\n~에 대해 (희망적인)/회의적인/(낙관적인)',
      lines: [
        '(hopeful)/(doubtful)/(optimistic) that절',
        '~에 대해 (희망적인)/회의적인/(낙관적인)',
      ],
      speakable: true,
    },
  ],
};

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function loadSetIds(): string[] {
  if (typeof window === 'undefined') return [];
  const ids = safeParse<string[]>(localStorage.getItem(VOCA_SET_IDS_KEY));
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function saveSetIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOCA_SET_IDS_KEY, JSON.stringify(Array.from(new Set(ids))));
}

function normalizeStoredSet(raw: VocaSet): VocaSet {
  const version = normalizeVersionForCourse(raw.course, raw.version);

  return {
    ...raw,
    version,
    id: makeVocaSetId(raw.course, raw.track, version, raw.day),
    title: makeVocaDisplayTitle(raw.course, raw.track, version, raw.day),
    displayTitle: makeVocaDisplayTitle(raw.course, raw.track, version, raw.day),
  };
}

function sortVocaSets(sets: VocaSet[]) {
  return sets.sort((a, b) => {
    const courseOrder = a.course.localeCompare(b.course);
    if (courseOrder !== 0) return courseOrder;
    const trackOrder = a.track.localeCompare(b.track);
    if (trackOrder !== 0) return trackOrder;
    const versionOrder = getVersionSortIndex(a.version) - getVersionSortIndex(b.version);
    if (versionOrder !== 0) return versionOrder;
    return Number(a.day.replace(/\D/g, '')) - Number(b.day.replace(/\D/g, ''));
  });
}

function normalizeAndDedupeSets(sets: VocaSet[]) {
  const byId = new Map<string, VocaSet>();

  for (const set of sets) {
    const normalized = normalizeStoredSet(set);
    byId.set(normalized.id, normalized);
  }

  return sortVocaSets(Array.from(byId.values()));
}

export function saveVocaSet(set: VocaSet) {
  if (typeof window === 'undefined') return;

  const version = normalizeVersionForCourse(set.course, set.version);
  const id = makeVocaSetId(set.course, set.track, version, set.day);
  const normalized = normalizeStoredSet({
    ...set,
    version,
    id,
    title: makeVocaDisplayTitle(set.course, set.track, version, set.day),
    displayTitle: makeVocaDisplayTitle(set.course, set.track, version, set.day),
  });
  const ids = loadSetIds();

  localStorage.setItem(makeSetStorageKey(id), JSON.stringify(normalized));
  saveSetIds([...ids.filter((savedId) => savedId !== id), id]);
}

export function getVocaSets(): VocaSet[] {
  if (typeof window === 'undefined') return [];

  const ids = loadSetIds();
  const sets = ids
    .map((id) => safeParse<VocaSet>(localStorage.getItem(makeSetStorageKey(id))))
    .filter((set): set is VocaSet => Boolean(set))
    .map(normalizeStoredSet);

  return normalizeAndDedupeSets(sets);
}

export async function fetchRemoteVocaSets(): Promise<VocaSet[]> {
  const response = await fetch('/api/voca-sets', { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 불러오지 못했습니다.');
  }

  return Array.isArray(result.sets) ? normalizeAndDedupeSets(result.sets) : [];
}

export async function saveRemoteVocaSet(set: VocaSet): Promise<VocaSet[]> {
  const normalizedSet = normalizeStoredSet(set);
  const response = await fetch('/api/voca-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set: normalizedSet }),
  });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 저장하지 못했습니다.');
  }

  return Array.isArray(result.sets) ? normalizeAndDedupeSets(result.sets) : [];
}

export async function deleteRemoteVocaSet(id: string): Promise<VocaSet[]> {
  const response = await fetch(`/api/voca-sets?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 삭제하지 못했습니다.');
  }

  return Array.isArray(result.sets) ? normalizeAndDedupeSets(result.sets) : [];
}

export async function syncLocalVocaSetsToRemote(): Promise<VocaSet[]> {
  const localSets = getVocaSets();
  let remoteSets = await fetchRemoteVocaSets();

  for (const localSet of localSets) {
    const alreadyRemote = remoteSets.some((remoteSet) => remoteSet.id === localSet.id);
    if (!alreadyRemote) {
      remoteSets = await saveRemoteVocaSet(localSet);
    }
  }

  return remoteSets;
}

export function getVocaSetById(id: string): VocaSet | null {
  if (typeof window === 'undefined') return null;
  const set = safeParse<VocaSet>(localStorage.getItem(makeSetStorageKey(id)));
  return set ? normalizeStoredSet(set) : null;
}

export function getVocaSetsByScope(
  course: VocaCourse,
  track: VocaTrack,
  version?: VocaVersion
): VocaSet[] {
  return getVocaSets().filter(
    (set) =>
      set.course === course &&
      set.track === track &&
      (!version || set.version === version)
  );
}

export function deleteVocaSet(id: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(makeSetStorageKey(id));
  saveSetIds(loadSetIds().filter((savedId) => savedId !== id));
}

export function loadLatestVocaSet(): VocaSet | null {
  if (typeof window === 'undefined') return null;
  const latestSavedSet = getVocaSets()[0] ?? null;
  if (latestSavedSet) return latestSavedSet;

  const legacySet = safeParse<VocaSet>(localStorage.getItem(LEGACY_VOCA_SET_KEY));
  return legacySet ? normalizeStoredSet(legacySet) : null;
}

export function saveLatestVocaSet(set: VocaSet) {
  if (typeof window === 'undefined') return;
  saveVocaSet(set);
}

export function loadVocaProgress(setId: string): VocaProgressMap {
  if (typeof window === 'undefined') return {};
  const allProgress = safeParse<Record<string, VocaProgressMap>>(
    localStorage.getItem(VOCA_PROGRESS_KEY)
  );
  return allProgress?.[setId] ?? {};
}

export function saveVocaProgress(setId: string, progress: VocaProgressMap) {
  if (typeof window === 'undefined') return;
  const allProgress =
    safeParse<Record<string, VocaProgressMap>>(localStorage.getItem(VOCA_PROGRESS_KEY)) ?? {};

  localStorage.setItem(
    VOCA_PROGRESS_KEY,
    JSON.stringify({
      ...allProgress,
      [setId]: progress,
    })
  );
}
