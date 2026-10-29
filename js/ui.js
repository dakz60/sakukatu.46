import { db } from './storage.js';
import { labels, members } from '../data/features.js';
import { getPhotoURL } from './photoStorage.js';

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
export function photoCount(item) {
  const count = Number(item.count);
  return Number.isSafeInteger(count) && count >= 0 && item.count !== '' && item.count != null ? count : (item.status === '未所持' || item.status === '購入予定' ? 0 : 1);
}
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
    return (!$('#photoMember').value || item.member === $('#photoMember').value)
      && (!$('#photoSeries').value || item.series === $('#photoSeries').value)
      && (!$('#photoCategory').value || item.category === $('#photoCategory').value)
      && (!$('#photoOwnership').value || ($('#photoOwnership').value === 'duplicates' ? count > 1 : $('#photoOwnership').value === 'owned' ? count > 0 : count === 0))
      && [item.member, item.series, item.pose, item.note].some(value => String(value || '').toLowerCase().includes(query));
  });
  $('#photoSummary').textContent = `登録 ${db.photos.length}種類 / 所持 ${db.photos.reduce((sum, item) => sum + photoCount(item), 0)}枚 / ダブり ${db.photos.reduce((sum, item) => sum + Math.max(0, photoCount(item) - 1), 0)}枚`;
  $('#photoResults').textContent = `${items.length}種類を表示`;
  const list = $('#list-photos');
  list.innerHTML = items.length ? items.map(item => {
    const index = db.photos.indexOf(item);
    const count = photoCount(item);
    return `<article class="photo-card ${count === 0 ? 'unowned' : ''}">
      <div class="photo-image" data-photo-id="${escapeHtml(item.id)}"><span>画像なし</span></div>
      <div class="photo-info"><span class="tag">${escapeHtml(item.category || '分類未設定')}</span>
      <h3>${escapeHtml(item.member)}</h3><p>${escapeHtml(item.series)}</p><p>${escapeHtml(item.pose || 'ポーズ未設定')}</p>
      ${item.note ? `<p class="photo-note">${escapeHtml(item.note)}</p>` : ''}
      <span class="ownership">${count === 0 ? '未所持' : count > 1 ? `ダブり ${count - 1}枚` : '所持'}</span>
      <div class="photo-counter"><button type="button" data-count="${index}" data-delta="-1" aria-label="${escapeHtml(item.member + ' ' + item.pose)}の所持枚数を減らす" ${count === 0 ? 'disabled' : ''}>−</button><strong>${count}枚</strong><button type="button" data-count="${index}" data-delta="1" aria-label="${escapeHtml(item.member + ' ' + item.pose)}の所持枚数を増やす">＋</button></div>
      <div class="photo-actions"><button class="subtle" data-edit-photo="${index}">編集</button><button class="del" data-delete="photos" data-index="${index}">削除</button></div></div></article>`;
  }).join('') : empty(db.photos.length ? '条件に合う生写真がありません。' : '最初の1枚を登録しましょう。現物を撮影して、メンバー・シリーズ・枚数を記録できます。');
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
  return items.map(item => `<div class="data-row"><div class="data-main"><strong>${escapeHtml(item.title || item.member || '')}</strong><small>${escapeHtml([item.date, item.type, item.status, item.venue, item.note, item.amount ? `¥${Number(item.amount).toLocaleString()}` : ''].filter(Boolean).join(' / '))}</small></div>${collection === 'todos' ? `<input type="checkbox" aria-label="完了" data-done="${item.id}" ${item.done ? 'checked' : ''}>` : ''}<button class="del" data-delete="${collection}" data-index="${db[collection].indexOf(item)}">削除</button></div>`).join('') || empty('まだ記録がありません');
}
export function render() {
  renderPhotos();
  for (const collection of Object.keys(labels).filter(name => name !== 'photos')) {
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
  $('#profileName').textContent = db.profile.name;
  $('#profileGroup').textContent = db.profile.group;
  $('#profileBirthdayText').textContent = db.profile.birthday || '未登録';
  $('#homeMilestones').innerHTML = $('#list-milestones').innerHTML = empty('記念日機能は準備中です');
}
