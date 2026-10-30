import { reportCard, loadReportImages } from './reports.js?v=20261030-5';
import { db } from './storage.js?v=20261030-5';
import { labels, members } from '../data/features.js?v=20261030-5';
import { getPhotoURL } from './photoStorage.js?v=20261030-5';

export const $ = (selector) => document.querySelector(selector);
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let toastTimer;
export function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2500);
}
export function go(page, update = render) {
  document.querySelectorAll('.section').forEach(el => el.classList.toggle('active', el.id === `page-${page}`));
  document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('#crumb').textContent = labels[page] || (page === 'home' ? 'ホーム' : 'メンバー別記念日');
  $('#sidebar').classList.remove('open');
  update();
}
export { photoCount } from './collectionModel.js?v=20261030-5';
import { photoCount, offerCount, wantCount, anniversaryInfo, daysToAnniversary } from './collectionModel.js?v=20261030-5';
export let photoView = 'all';
export function setPhotoView(view) { photoView = view; render(); }
const empty = (message) => `<div class="empty">${escapeHtml(message)}</div>`;
function options(selector, values, placeholder) {
  const select = $(selector);
  const previous = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` + [...new Set(values)].filter(Boolean).map(value => `<option>${escapeHtml(value)}</option>`).join('');
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
}
function renderPhotos() {
  options('#photoMember', [...members.map(member => member.name), ...db.photos.map(item => item.member)], 'すべてのメンバー');
  options('#photoSeries', db.photos.map(item => item.series), 'すべてのシリーズ');
  const query = $('[data-search="photos"]').value.trim().toLowerCase();
  const items = db.photos.filter(item => {
    const count = photoCount(item);
    return (photoView === 'all' || (photoView === 'owned' ? count > 0 : photoView === 'offer' ? offerCount(item) > 0 : wantCount(item) > 0))
      && (!$('#photoMember').value || item.member === $('#photoMember').value)
      && (!$('#photoSeries').value || item.series === $('#photoSeries').value)
      && (!$('#photoCategory').value || item.category === $('#photoCategory').value)
      && (!$('#photoOwnership').value || ($('#photoOwnership').value === 'duplicates' ? count > 1 : $('#photoOwnership').value === 'owned' ? count > 0 : count === 0))
      && [item.member, item.series, item.pose, item.note].some(value => String(value || '').toLowerCase().includes(query));
  });
  $('#photoSummary').textContent = `登録 ${db.photos.length}種類 / 所持 ${db.photos.reduce((sum, item) => sum + photoCount(item), 0)}枚 / ダブり ${db.photos.reduce((sum, item) => sum + Math.max(0, photoCount(item) - 1), 0)}枚`;
  document.querySelectorAll('[data-photo-view]').forEach(button => { button.classList.toggle('active', button.dataset.photoView === photoView); button.setAttribute('aria-pressed', String(button.dataset.photoView === photoView)); });
  $('#tradeHistory').innerHTML = db.trades.map(trade => `<div class="data-row"><div><strong>${escapeHtml(new Date(trade.date).toLocaleString('ja-JP'))}</strong>${trade.lines.map(line => `<p>${escapeHtml(line.member)} / ${escapeHtml(line.series)} / ${escapeHtml(line.pose || '')}：渡した ${line.give}枚・受け取った ${line.receive}枚</p>`).join('')}</div></div>`).join('') || empty('まだ交換の記録がありません');
  $('#photoResults').textContent = `${items.length}種類を表示`;
  const list = $('#list-photos');
  list.innerHTML = items.length ? items.map(item => {
    const index = db.photos.indexOf(item);
    const count = photoCount(item);
    return `<article class="photo-card ${count === 0 ? 'unowned' : ''}">
      <div class="photo-image" data-photo-id="${escapeHtml(item.imageId || item.id)}"><span>画像なし</span></div>
      <div class="photo-info"><span class="tag">${escapeHtml(item.category || '分類未設定')}</span>
      <h3>${escapeHtml(item.member)}</h3><p>${escapeHtml(item.series)}</p><p>${escapeHtml(item.pose || 'ポーズ未設定')}</p>
      ${item.note ? `<p class="photo-note">${escapeHtml(item.note)}</p>` : ''}
      <span class="ownership">${count === 0 ? '未所持' : count > 1 ? `ダブり ${count - 1}枚` : '所持'}</span>
      <p class="trade-counts">提供 ${offerCount(item)}枚 · 希望 ${wantCount(item)}枚</p>
      <div class="photo-counter"><button type="button" data-count="${index}" data-delta="-1" aria-label="${escapeHtml(item.member + ' ' + item.pose)}の所持枚数を減らす" ${count === 0 ? 'disabled' : ''}>−</button><strong>${count}枚</strong><button type="button" data-count="${index}" data-delta="1" aria-label="${escapeHtml(item.member + ' ' + item.pose)}の所持枚数を増やす">＋</button></div>
      <div class="photo-actions"><button class="subtle" data-edit-photo="${index}">編集</button><button class="del" data-delete="photos" data-index="${index}">削除</button></div></div></article>`;
  }).join('') : empty(db.photos.length ? '条件に合う生写真がありません。' : '生写真は未登録です。画像・メンバー・シリーズ・枚数を登録できます。');
  list.querySelectorAll('[data-photo-id]').forEach(async element => {
    try {
      const url = await getPhotoURL(element.dataset.photoId);
      if (url && element.isConnected) {
        const image = new Image();
        image.src = url;
        image.alt = '登録した生写真';
        element.replaceChildren(image);
      }
    } catch { if (element.isConnected) element.textContent = '画像を読み込めませんでした'; }
  });
}
function rows(collection, items) {
  return items.map(item => `<div class="data-row"><div class="data-main"><strong>${escapeHtml(item.title || item.member || '')}</strong><small>${escapeHtml([item.date, item.type, item.status, item.venue, item.note, item.amount ? `¥${Number(item.amount).toLocaleString()}` : ''].filter(Boolean).join(' / '))}</small></div>${['reports', 'lives'].includes(collection) ? `<button class="subtle" data-create-milestone="${collection}" data-index="${db[collection].indexOf(item)}">記念日に追加</button>` : ''}${collection === 'todos' ? `<input type="checkbox" aria-label="完了" data-done="${item.id}" ${item.done ? 'checked' : ''}>` : ''}<button class="del" data-delete="${collection}" data-index="${db[collection].indexOf(item)}">削除</button></div>`).join('') || empty('まだ記録がありません');
}
export function render() {
  renderPhotos();
  for (const collection of Object.keys(labels).filter(name => !['photos', 'milestones', 'reports'].includes(name))) {
    const query = $(`[data-search="${collection}"]`)?.value.toLowerCase() || '';
    const filter = $(`[data-filter="${collection}"]`)?.value || '';
    $(`#list-${collection}`).innerHTML = rows(collection, db[collection].filter(item => Object.values(item).join(' ').toLowerCase().includes(query) && (!filter || item.type === filter || item.status === filter)));
  }
  const today = new Date();
  const date = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const end = new Date(today); end.setDate(end.getDate() + 7);
  const upcoming = db.schedule.filter(item => item.date >= date).sort((a,b) => a.date.localeCompare(b.date));
  $('#homeEvents').innerHTML = rows('schedule', upcoming.slice(0, 5));
  $('#homeTodos').innerHTML = rows('todos', db.todos.filter(item => !item.done).slice(0, 5));
  $('#homeReports').innerHTML = rows('reports', db.reports.slice(0, 3));
  $('#statEvents').textContent = `${upcoming.filter(item => new Date(item.date) < end).length}件`;
  $('#statDeadlines').textContent = `${db.tickets.filter(item => item.date >= date && !['落選','入金済み'].includes(item.status)).length}件`;
  $('#statReports').textContent = `${db.reports.length}件`;
  const spend = db.money.filter(item => item.date?.startsWith(date.slice(0,7))).reduce((sum,item) => sum + (Number(item.amount) || 0), 0);
  $('#moneyTotal').textContent = $('#statSpend').textContent = `¥${spend.toLocaleString()}`;
  const favorites = (db.profile.members || [db.profile.name]).map(name => members.find(member => member.name === name)).filter(Boolean);
  $('#profileName').textContent = favorites.length ? favorites.map(member => member.name).join('・') : '推しメンバー';
  $('#profileGroup').textContent = db.profile.group;
  $('#profileBirthdayText').textContent = favorites.length ? favorites.map(member => `${member.name} ${member.birthday.slice(5).replace('-', '/')}`).join(' / ') : '未登録';
  $('#birthdayText').textContent = favorites.length ? favorites.map(member => {
    const birthday = new Date(today.getFullYear(), Number(member.birthday.slice(5, 7)) - 1, Number(member.birthday.slice(8, 10)));
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (birthday < start) birthday.setFullYear(birthday.getFullYear() + 1);
    return `${member.name} あと${Math.round((birthday - start) / 86400000)}日`;
  }).join(' / ') : '未登録';
  const reportQuery = $('[data-search="reports"]').value.trim().toLowerCase();
  $('#list-reports').innerHTML = db.reports.filter(item => [item.member, item.title, item.note, item.part, ...(item.messages || []).map(message => message.text || '')].join(' ').toLowerCase().includes(reportQuery)).map(item => reportCard(item, db.reports.indexOf(item))).join('') || empty('レポは未登録です');
  loadReportImages($('#list-reports'));
  renderMilestones();
}

function loadImages(container) {
  container.querySelectorAll('[data-memory-image]').forEach(async element => {
    try { const url = await getPhotoURL(element.dataset.memoryImage); if (url && element.isConnected) { const image = new Image(); image.src = url; image.alt = '記念日の写真'; element.replaceChildren(image); } }
    catch { if (element.isConnected) element.textContent = '画像を読み込めませんでした'; }
  });
}
function milestoneCard(item, compact = false) {
  const index = db.milestones.indexOf(item);
  return `<article class="milestone-card"><time>${escapeHtml(item.date)}</time><h3>${escapeHtml(item.title)}</h3><p class="tag">${escapeHtml((item.members || []).join('・'))}</p><p class="anniversary">${escapeHtml(anniversaryInfo(item.date))}</p>${!compact && item.note ? `<p class="memory-note">${escapeHtml(item.note)}</p>` : ''}${!compact && item.imageId ? `<div class="memory-image" data-memory-image="${escapeHtml(item.imageId)}"></div>` : ''}<div class="photo-actions"><button class="subtle" data-edit-milestone="${index}">編集</button><button class="del" data-delete="milestones" data-index="${index}">削除</button></div></article>`;
}
function renderMilestones() {
  options('#milestoneMember', [...members.map(member => member.name), ...db.milestones.flatMap(item => item.members || [])], 'すべてのメンバー');
  const query = $('[data-search="milestones"]').value.trim().toLowerCase();
  const filter = $('#milestoneMember').value;
  const items = [...db.milestones].sort((a,b) => b.date.localeCompare(a.date));
  $('#list-milestones').innerHTML = items.filter(item => (!filter || (item.members || []).includes(filter)) && [item.title, item.note, ...(item.members || [])].join(' ').toLowerCase().includes(query)).map(item => milestoneCard(item)).join('') || empty('記念日は未登録です');
  const favorites = db.profile.members || [db.profile.name];
  const home = items.filter(item => (item.members || []).some(member => favorites.includes(member))).sort((a, b) => {
    const aDays = daysToAnniversary(a.date), bDays = daysToAnniversary(b.date);
    return (aDays <= 30 ? aDays : Infinity) - (bDays <= 30 ? bDays : Infinity) || b.date.localeCompare(a.date);
  });
  $('#homeMilestones').innerHTML = home.slice(0,3).map(item => milestoneCard(item, true)).join('') || empty('推しメンの記念日を登録すると表示されます');
  loadImages($('#list-milestones'));
}
