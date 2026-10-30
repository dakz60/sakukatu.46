'use strict';

const STORAGE_KEY = 'oshi-note-v1';

let stored = {};

try {
  stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
} catch {
  stored = {};
}

const db = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
if (!Array.isArray(db.trades)) db.trades = [];

for (const name of collections) {
  if (!Array.isArray(db[name])) {
    db[name] = [];
  }
}

if (!db.profile || typeof db.profile !== 'object' || Array.isArray(db.profile)) {
  db.profile = {
    name: '推しメンバー',
    group: '櫻坂46',
    birthday: '',
    anniversary: '',
  };
}

db.profile.group = '櫻坂46';

if (!db.profile.anniversary) {
  db.profile.anniversary = '';
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

if (db.profile.members != null && !Array.isArray(db.profile.members)) delete db.profile.members;

db.photos = migratePhotos(db.photos);
function imageInUse(id) {
  return [...db.photos, ...db.milestones].some(item => String(item.imageId || item.id) === String(id)) || db.reports.some(item => [item.memberAvatarId,item.selfAvatarId,...(item.messages || []).map(message => message.imageId)].includes(id));
}
