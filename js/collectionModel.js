export function photoCount(item) {
  const count = Number(item.count);
  return Number.isSafeInteger(count) && count >= 0 && item.count !== '' && item.count != null ? count : (['未所持', '購入予定'].includes(item.status) ? 0 : 1);
}
export const offerCount = item => Math.min(photoCount(item), Math.max(0, Number(item.offer) || 0));
export const keepCount = item => photoCount(item) - offerCount(item);
export const wantCount = item => Math.max(0, Number(item.want) || 0);
export function applyTrade(photos, lines) {
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
export function anniversaryInfo(date, now = new Date()) {
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

export function daysToAnniversary(date, now = new Date()) {
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return Infinity;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (start > today) return Infinity;
  let year = Math.max(today.getFullYear(), start.getFullYear() + 1);
  let next = new Date(year, start.getMonth(), start.getDate());
  if (next < today) next = new Date(++year, start.getMonth(), start.getDate());
  return Math.round((Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

export function supportingDays(date, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) return null;
  const elapsed = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(year, month - 1, day)) / 86400000);
  return elapsed >= 0 ? elapsed + 1 : null;
}
