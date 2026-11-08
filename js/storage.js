'use strict';

const STORAGE_KEY = 'oshi-note-v1';

let stored = {};

try {
  stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
  stored = {};
}

const db =
  stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored
    : {};

if (!Array.isArray(db.trades)) {
  db.trades = [];
}

for (const name of collections) {
  if (!Array.isArray(db[name])) {
    db[name] = [];
  }
}

if (
  !db.profile ||
  typeof db.profile !== 'object' ||
  Array.isArray(db.profile)
) {
  db.profile = {
    name: '推しメンバー',
    group: '櫻坂46',
    birthday: '',
    anniversary: ''
  };
}

db.profile.group = '櫻坂46';

if (!db.profile.anniversary) {
  db.profile.anniversary = '';
}

if (
  db.profile.members != null &&
  !Array.isArray(db.profile.members)
) {
  delete db.profile.members;
}

db.photos = migratePhotos(db.photos);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function imageInUse(id) {
  if (id == null || id === '') return false;

  const key = String(id);

  const references = [
    ...db.photos.map((item) => item.imageId || item.id),

    ...db.goods.map((item) => item.imageId),

    ...(db.goodsCatalog || []).map((item) => item.iconId),

    ...db.places.flatMap((item) => [
      item.imageId,
      ...(Array.isArray(item.visits) ? item.visits : []).flatMap(
        (visit) =>
          Array.isArray(visit.imageIds) ? visit.imageIds : []
      )
    ]),

    ...db.milestones.map((item) => item.imageId || item.id),

    ...db.reports.flatMap((item) => [
      item.memberAvatarId,
      item.selfAvatarId,
      ...(item.messages || []).map((message) => message.imageId)
    ]),

    db.appearance?.backgroundId,

    ...Object.values(db.appearance?.pages || []).map(
      (item) => item?.backgroundId
    ),

    ...Object.values(db.photoSeriesIcons || {}).flatMap(
      (icons) =>
        Object.values(icons).map((icon) => icon?.imageId)
    )
  ];

  return references.some(
    (value) => value != null && String(value) === key
  );
}
