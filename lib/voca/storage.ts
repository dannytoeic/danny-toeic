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
  return course === '600' ? ['ver.1', 'ver.2'] : ['ver.1', 'ver.2', 'ver.3'];
}

export function makeVocaSetId(
  course: VocaCourse,
  track: VocaTrack,
  version: VocaVersion,
  day: VocaDay
) {
  return `danny-voca-set-${course}-${track}-${version}-${day.replace(/\s+/g, '')}`;
}

export function makeVocaDisplayTitle(
  course: VocaCourse,
  track: VocaTrack,
  version: VocaVersion,
  day: VocaDay
) {
  return `${course}반 ${track} ${version} ${day}`;
}

function makeSetStorageKey(id: string) {
  return id;
}

export const sampleVocaSet: VocaSet = {
  id: 'sample-danny-voca-800-A-ver.1-Day1',
  title: '800반 A ver.1 Day 1',
  displayTitle: '800반 A ver.1 Day 1',
  course: '800',
  track: 'A',
  book: '시제품 샘플',
  version: 'ver.1',
  day: 'Day 1',
  items: [
    {
      id: 'sample-word-1',
      type: 'word',
      term: 'tentative',
      pos: '형',
      meaning: '잠정적인 / 일시적인',
      rawText: 'tentative (형) (잠정적인/일시적인)',
      speakable: true,
    },
    {
      id: 'sample-phrase-1',
      type: 'phrase',
      term: 'traffic congestion',
      pos: '명',
      meaning: '교통체증',
      rawText: 'traffic congestion (명) (교통체증)',
      speakable: true,
    },
    {
      id: 'sample-phrase-2',
      type: 'phrase',
      term: 'make an announcement',
      meaning: '발표하다 / 공표하다',
      rawText: 'make an announcement (발표하다/공표하다)',
      speakable: true,
    },
    {
      id: 'sample-note-1',
      type: 'note',
      title: 'rate',
      lines: ['1. 명사', '(1) (요금) room rates (객실요금)', '(2) (비율) interest rate (이자율)'],
      rawText: '* rate\n1. 명사\n(1) (요금) room rates (객실요금)',
      speakable: false,
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
  return {
    ...raw,
    id: raw.id || makeVocaSetId(raw.course, raw.track, raw.version, raw.day),
    title: raw.title || makeVocaDisplayTitle(raw.course, raw.track, raw.version, raw.day),
    displayTitle:
      raw.displayTitle || makeVocaDisplayTitle(raw.course, raw.track, raw.version, raw.day),
  };
}

export function saveVocaSet(set: VocaSet) {
  if (typeof window === 'undefined') return;

  const id = makeVocaSetId(set.course, set.track, set.version, set.day);
  const normalized = normalizeStoredSet({
    ...set,
    id,
    title: set.title || makeVocaDisplayTitle(set.course, set.track, set.version, set.day),
    displayTitle: makeVocaDisplayTitle(set.course, set.track, set.version, set.day),
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

  return sets.sort((a, b) => {
    const courseOrder = a.course.localeCompare(b.course);
    if (courseOrder !== 0) return courseOrder;
    const trackOrder = a.track.localeCompare(b.track);
    if (trackOrder !== 0) return trackOrder;
    const versionOrder = a.version.localeCompare(b.version);
    if (versionOrder !== 0) return versionOrder;
    return Number(a.day.replace(/\D/g, '')) - Number(b.day.replace(/\D/g, ''));
  });
}

export async function fetchRemoteVocaSets(): Promise<VocaSet[]> {
  const response = await fetch('/api/voca-sets', { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 불러오지 못했습니다.');
  }

  return Array.isArray(result.sets) ? result.sets.map(normalizeStoredSet) : [];
}

export async function saveRemoteVocaSet(set: VocaSet): Promise<VocaSet[]> {
  const response = await fetch('/api/voca-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set }),
  });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 저장하지 못했습니다.');
  }

  return Array.isArray(result.sets) ? result.sets.map(normalizeStoredSet) : [];
}

export async function deleteRemoteVocaSet(id: string): Promise<VocaSet[]> {
  const response = await fetch(`/api/voca-sets?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const result = await response.json();

  if (!response.ok || !result?.success) {
    throw new Error(result?.message ?? 'Danny Voca 세트를 삭제하지 못했습니다.');
  }

  return Array.isArray(result.sets) ? result.sets.map(normalizeStoredSet) : [];
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
