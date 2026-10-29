import { db } from './storage.js';
import { labels } from '../data/features.js';
import { getPhotoURL } from './photoStorage.js';

export const $ = (selector) => document.querySelector(selector);

export const escapeHtml = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

export const yen = (value) =>
  '¥' + Number(value || 0).toLocaleString('ja-JP');

export function formatDate(value) {
  if (!value) return '日付未設定';

  const date = new Date(value + 'T00:00:00');

  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, '0')}（${'日月火水木金土'[date.getDay()]}）`;
}

function countdown(value) {
  if (!value) return '未登録';

  const [year, month, day] = value.split('-').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let next = new Date(today.getFullYear(), month - 1, day);
  next.setHours(0, 0, 0, 0);

  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }

  const days = Math.round((next - today) / 86400000);

  return days === 0 ? '今日！' : `あと${days}日（${month}/${day}）`;
}

export function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');

  setTimeout(() => element.classList.remove('show'), 2100);
}

export function go(page, render) {
  document
    .querySelectorAll('.section')
    .forEach((element) => element.classList.remove('active'));

  $('#page-' + page)?.classList.add('active');

  document
    .querySelectorAll('.nav button')
    .forEach((element) => {
      element.classList.toggle('active', element.dataset.page === page);
    });

  $('#crumb').textContent = page === 'home' ? 'ホーム' : labels[page];
  $('#sidebar').classList.remove('open');

  render();
}

function makeRow(icon, title, meta, tag, collection, index, itemId) {
  const image =
    collection === 'photos'
      ? `<div class="photo-record-thumb" data-photo-preview="${itemId}">${icon}</div>`
      : `<div class="profile-pic" style="width:39px;height:39px;border-radius:12px;font-size:17px">${icon}</div>`;

  return `
    <div class="data-row">
      ${image}
      <div class="data-main">
        <strong>${escapeHtml(title || '（タイトルなし）')}</strong>
        <small>${escapeHtml(meta || '')}</small>
      </div>
      ${tag ? `<span class="tag">${escapeHtml(tag)}</span>` : ''}
      <button
        class="del"
        data-delete="${collection}"
        data-index="${index}"
        aria-label="削除"
      >削除</button>
    </div>
  `;
}

function renderList(collection, row) {
  const root = $('#list-' + collection);
  if (!root) return;

  const query = ($(`[data-search="${collection}"]`)?.value || '').toLowerCase();
  const filter = $(`[data-filter="${collection}"]`)?.value || '';

  const matches = db[collection]
    .map((item, index) => ({ ...item, _index: index }))
    .filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query) &&
      (!filter || item.type === filter || item.status === filter)
    );

  root.innerHTML = matches.length
    ? matches.map((item) => row(item, item._index)).join('')
    : '<div class="empty"><span>✿</span>まだ登録がありません</div>';

  if (collection === 'photos') {
    matches.forEach(async (item) => {
      const url = await getPhotoURL(item.id);
      const preview = root.querySelector(
        `[data-photo-preview="${item.id}"]`
      );

      if (url && preview) {
        preview.innerHTML = `<img src="${url}" alt="生写真">`;
      }
    });
  }
}

export function render() {
  const today = new Date();
  const week = new Date(today);
  week.setDate(week.getDate() + 7);

  $('#todayText').textContent =
    `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日　大切な予定も、思い出もここに。`;

  $('#statEvents').textContent =
    db.schedule.filter((item) =>
      item.date &&
      new Date(item.date + 'T00:00:00') >= new Date(today.toDateString()) &&
      new Date(item.date + 'T00:00:00') <= week
    ).length + '件';

  $('#statDeadlines').textContent =
    db.tickets.filter((item) =>
      item.date && !['落選', '入金済み'].includes(item.status)
    ).length + '件';

  $('#statReports').textContent = db.reports.length + '件';

  const month = today.toISOString().slice(0, 7);

  const spending = db.money
    .filter((item) => (item.date || '').startsWith(month))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  $('#statSpend').textContent = yen(spending);
  $('#moneyTotal').textContent = yen(spending);

  $('#profileName').textContent = db.profile.name || '推しメンバー';
  $('#profileGroup').textContent = '櫻坂46';
  $('#birthdayText').textContent = countdown(db.profile.birthday);
  $('#anniversaryText').textContent = countdown(db.profile.anniversary);

  const events = [...db.schedule]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 4);

  $('#homeEvents').innerHTML = events.length
    ? events.map((item) => `
        <div class="event">
          <div class="datebox">
            <small>
              ${item.date
                ? new Date(item.date + 'T00:00:00').getMonth() + 1 + '月'
                : '日付'}
            </small>
            ${item.date
              ? String(new Date(item.date + 'T00:00:00').getDate()).padStart(2, '0')
              : '—'}
          </div>
          <div>
            <div class="event-title">${escapeHtml(item.title)}</div>
            <div class="event-meta">
              ${escapeHtml(item.type || '')}　${escapeHtml(item.place || '')}
            </div>
          </div>
          <span class="tag">${escapeHtml(item.type || '予定')}</span>
        </div>
      `).join('')
    : '<div class="empty"><span>✿</span>予定を追加して、推し活を計画しよう</div>';

  const todos = db.todos
    .filter((item) => !item.done)
    .slice(0, 4);

  $('#homeTodos').innerHTML = todos.length
    ? todos.map((item) => `
        <div class="task">
          <input type="checkbox" data-done="${item.id}">
          <label>${escapeHtml(item.title)}</label>
          <small>${item.date ? formatDate(item.date) : ''}</small>
        </div>
      `).join('')
    : '<div class="empty">ToDoはありません。ゆっくり推し活しよう ♡</div>';

  $('#homeReports').innerHTML = db.reports.length
    ? db.reports.slice(0, 2).map((item) => `
        <div
          class="data-row"
          style="padding:9px 0;border:0;border-top:1px solid var(--line);border-radius:0"
        >
          <div class="profile-pic" style="width:36px;height:36px;font-size:16px">♡</div>
          <div class="data-main">
            <strong>${escapeHtml(item.member)}</strong>
            <small>${formatDate(item.date)}　${escapeHtml(item.title || 'ミーグリ')}</small>
          </div>
        </div>
      `).join('')
    : '<div class="empty">レポを書いて思い出を残そう</div>';

  renderList('schedule', (item, index) =>
    makeRow(
      '▦',
      item.title,
      `${formatDate(item.date)} · ${item.place || ''}`,
      item.type,
      'schedule',
      index
    )
  );

  renderList('tickets', (item, index) =>
    makeRow(
      '♧',
      item.title,
      `${formatDate(item.date)} · ${item.note || ''}`,
      item.status,
      'tickets',
      index
    )
  );

  renderList('goods', (item, index) =>
    makeRow(
      '✿',
      item.title,
      `${item.type || ''} · ${item.note || ''}${item.price ? ' · ' + yen(item.price) : ''}`,
      item.status,
      'goods',
      index
    )
  );

  renderList('photos', (item, index) =>
    makeRow(
      '▧',
      item.member,
      `${item.series || ''} · ${item.pose || ''} · ${item.count || 0}枚 ${item.note ? '· ' + item.note : ''}`,
      item.status,
      'photos',
      index,
      item.id
    )
  );

  renderList('lives', (item, index) =>
    makeRow(
      '♫',
      item.title,
      `${formatDate(item.date)} · ${item.venue || ''} · ${item.seat || ''} ${item.note || ''}`,
      '参戦済み',
      'lives',
      index
    )
  );

  renderList('reports', (item, index) =>
    makeRow(
      '♡',
      item.member,
      `${formatDate(item.date)} · ${item.title || 'ミーグリ'} · ${item.note || ''}`,
      'レポ',
      'reports',
      index
    )
  );

  renderList('money', (item, index) =>
    makeRow(
      '￥',
      item.title,
      `${formatDate(item.date)} · ${item.type || ''}`,
      yen(item.amount),
      'money',
      index
    )
  );

  renderList('todos', (item, index) =>
    makeRow(
      '☑',
      item.title,
      `期限：${item.date ? formatDate(item.date) : 'なし'}`,
      item.done ? '完了' : '未完了',
      'todos',
      index
    )
  );

  renderList('places', (item, index) =>
    makeRow(
      '⌖',
      item.title,
      `${item.type || ''} · ${item.address || ''} ${item.note || ''}`,
      item.type,
      'places',
      index
    )
  );
}
