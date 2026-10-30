'use strict';

function photoCount(item) {
  const count = Number(item.count);
  return Number.isSafeInteger(count) && count >= 0 && item.count !== '' && item.count != null ? count : (['未所持', '購入予定'].includes(item.status) ? 0 : 1);
}
const offerCount = item => item.inventory ? (item.inventory === 'offer' ? photoCount(item) : 0) : Math.min(photoCount(item), Math.max(0, Number(item.offer) || 0));
const keepCount = item => item.inventory ? (item.inventory === 'collection' ? photoCount(item) : 0) : photoCount(item) - offerCount(item);
const wantCount = item => item.inventory ? (item.inventory === 'want' ? photoCount(item) : 0) : Math.max(0, Number(item.want) || 0);
function applyTrade(photos, lines) {
  if (photos.every(item => item.inventory)) return applySeparatedTrade(photos, lines);
  const result = photos.map(item => ({ ...item }));
  let given = 0, received = 0;
  for (const item of result) {
    const line = lines.find(line => String(line.id) === String(item.id));
    if (!line) continue;
    const give = Number(line.give), receive = Number(line.receive);
    if (![give, receive].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 99999) || give > offerCount(item)) throw new Error('提供できる枚数を超えています');
    item.count = photoCount(item) - give + receive;
    if (item.count > 99999) throw new Error('所持枚数の上限を超えています');
    item.offer = Math.min(item.count, offerCount(photos.find(photo => photo.id === item.id)) - give);
    item.want = Math.max(0, wantCount(item) - receive);
    item.status = item.count ? '所持' : '未所持';
    given += give; received += receive;
  }
  if (!given || !received) throw new Error('渡す写真ともらう写真をそれぞれ選んでください');
  return result;
}
function anniversaryInfo(date, now = new Date()) {
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
  if (days < 0) return `あと${-days}日`;
  let year = Math.max(today.getFullYear(), start.getFullYear() + 1);
  let next = new Date(year, start.getMonth(), start.getDate());
  if (next < today) next = new Date(++year, start.getMonth(), start.getDate());
  const until = Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return `${days}日目${until <= 30 ? ` · ${year - start.getFullYear()}周年まであと${until}日` : ''}`;
}

function daysToAnniversary(date, now = new Date()) {
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return Infinity;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (start > today) return Infinity;
  let year = Math.max(today.getFullYear(), start.getFullYear() + 1);
  let next = new Date(year, start.getMonth(), start.getDate());
  if (next < today) next = new Date(++year, start.getMonth(), start.getDate());
  return Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function supportingDays(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
  const elapsed = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
  return elapsed >= 0 ? elapsed + 1 : null;
}

function migratePhotos(photos) {
  return photos.flatMap(item => {
    if (item.inventory) return [{...item}];
    const imageId = item.imageId || item.id;
    const base = { ...item, imageId }; delete base.offer; delete base.want; delete base.keep;
    const result = [];
    if (keepCount(item) || (!offerCount(item) && !wantCount(item))) result.push({...base, inventory:'collection', count:keepCount(item)});
    if (offerCount(item)) result.push({...base, id:`${item.id}:offer`, inventory:'offer', count:offerCount(item)});
    if (wantCount(item)) result.push({...base, id:`${item.id}:want`, inventory:'want', count:wantCount(item)});
    return result;
  });
}
function applySeparatedTrade(photos, lines) {
  const result = photos.map(item => ({...item}));
  let given = 0, received = 0;
  const incoming = [];
  for (const line of lines) {
    const item = result.find(item => String(item.id) === String(line.id));
    const give = Number(line.give), receive = Number(line.receive);
    if (!item || ![give,receive].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 99999) || give > offerCount(item) || (receive && item.inventory !== 'want')) throw new Error('交換する写真と枚数を確認してください');
    if (give) item.count -= give;
    if (receive) { item.count = Math.max(0, item.count - receive); incoming.push({item,receive}); }
    given += give; received += receive;
  }
  if (!given || !received) throw new Error('渡す写真ともらう写真をそれぞれ選んでください');
  for (const {item,receive} of incoming) {
    let owned = result.find(photo => photo.inventory === 'collection' && ['member','series','pose','category'].every(key => (photo[key] || '') === (item[key] || '')));
    if (!owned) { owned = {...item, id:crypto.randomUUID(), inventory:'collection', count:0, favorite:false, favoriteAt:undefined}; result.push(owned); }
    owned.count = photoCount(owned) + receive;
    if (owned.count > 99999) throw new Error('枚数の上限を超えています');
  }
  return result;
}
