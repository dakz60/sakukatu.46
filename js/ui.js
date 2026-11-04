'use strict';

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );

let toastTimer;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    $('#toast').classList.remove('show');
  }, 2500);
}

function go(page, update = render) {
  document.querySelectorAll('.section').forEach((element) => {
    element.classList.toggle('active', element.id === `page-${page}`);
  });

  document.querySelectorAll('[data-page]').forEach((element) => {
    element.classList.toggle('active', element.dataset.page === page);
  });

  $('#crumb').textContent =
    labels[page] || (page === 'home' ? 'ホーム' : 'メンバー別記念日');

  $('#sidebar').classList.remove('open');

  update();

  document.dispatchEvent(new Event('pagechange'));
}

let photoView = 'owned';

function setPhotoView(view) {
  photoView = view;

  ['#photoMember', '#photoSeries', '#photoCategory'].forEach((selector) => {
    $(selector).value = '';
  });

  $('[data-search="photos"]').value = '';

  render();
}

const empty = (message) =>
  `<div class="empty">${escapeHtml(message)}</div>`;

function options(selector, values, placeholder) {
  const select = $(selector);
  const previous = select.value;

  select.innerHTML =
    `<option value="">${escapeHtml(placeholder)}</option>` +
    [...new Set(values)]
      .filter(Boolean)
      .map((value) => `<option>${escapeHtml(value)}</option>`)
      .join('');

  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function renderPhotos() {
  renderPhotoBrowser();
  renderSavedPhotos();
}

function renderSavedPhotos() {
  const inventory = photoView === 'owned' ? 'collection' : photoView;
  const orderedPhotos = sortPhotoRecords(db.photos);

  options(
    '#photoMember',
    [
      ...photoMemberOptions().map((member) => member.name),
      ...db.photos.map((item) => item.member)
    ],
    'すべてのメンバー・分類'
  );

  options(
    '#photoSeries',
    orderedPhotos
      .filter((item) => item.inventory === inventory)
      .map((item) => item.series),
    'すべてのシリーズ'
  );

  const query = $('[data-search="photos"]').value.trim().toLowerCase();

  const items = orderedPhotos.filter((item) => {
    return (
      (!$('#photoFavoritesOnly').checked || item.favorite) &&
      item.inventory === inventory &&
      (!$('#photoMember').value || item.member === $('#photoMember').value) &&
      (!$('#photoSeries').value || item.series === $('#photoSeries').value) &&
      (!$('#photoCategory').value || item.category === $('#photoCategory').value) &&
      [item.member, item.series, item.pose, item.note].some((value) =>
        String(value || '').toLowerCase().includes(query)
      )
    );
  });

  const all = db.photos.filter((item) => item.inventory === inventory);

  const title = {
    collection: 'コレクション',
    offer: '提供用',
    want: '希望'
  }[inventory];

  $('#photoSummary').textContent = `${title}：${all.length}件`;

  document
    .querySelectorAll('[data-add="photos"]:not([data-wish])')
    .forEach((button) => {
      button.textContent = `＋ ${title}を登録`;
    });

  document.querySelectorAll('[data-photo-view]').forEach((button) => {
    const active = button.dataset.photoView === photoView;

    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  $('#tradeHistory').innerHTML = db.trades.map((trade) => {
    const lines = trade.lines.map((line) => `
      <p>
        ${escapeHtml(line.member)} /
        ${escapeHtml(line.series)} /
        ${escapeHtml(line.pose || '')}：
        渡した ${line.give}枚・受け取った ${line.receive}枚
      </p>
    `).join('');

    return `
      <div class="data-row">
        <div>
          <strong>
            ${escapeHtml(new Date(trade.date).toLocaleString('ja-JP'))}
          </strong>
          ${lines}
        </div>
      </div>
    `;
  }).join('') || empty('まだ交換の記録がありません');

  $('#photoResults').textContent = `${items.length}件を表示`;

  const list = $('#list-photos');

  list.innerHTML = items.map((item) => {
    const index = db.photos.indexOf(item);
    const count = photoCount(item);
    const photoLabel = escapeHtml(
      [item.member, item.series, item.pose].filter(Boolean).join(' ')
    );

    return `
      <article
        class="photo-card ${count === 0 ? 'unowned' : ''}"
        tabindex="-1"
        data-photo-record="${escapeHtml(item.id)}"
      >
        <div
          class="photo-image"
          data-photo-id="${escapeHtml(item.imageId || item.id)}"
        >
          <span>画像なし</span>
        </div>

        <div class="photo-info">
          <span class="tag">
            ${escapeHtml(item.category || '分類未設定')}
          </span>

          <h3>${escapeHtml(item.member)}</h3>
          <p>${escapeHtml(item.series)}</p>
          <p>${escapeHtml(item.pose || 'ポーズ未設定')}</p>

          ${
            item.note
              ? `<p class="photo-note">${escapeHtml(item.note)}</p>`
              : ''
          }

          <div class="photo-counter">
            <button
              type="button"
              data-count="${index}"
              data-delta="-1"
              aria-label="${photoLabel}の枚数を減らす"
              ${count === 0 ? 'disabled' : ''}
            >−</button>

            <strong>${count}枚</strong>

            <button
              type="button"
              data-count="${index}"
              data-delta="1"
              aria-label="${photoLabel}の枚数を増やす"
            >＋</button>
          </div>

          <div class="photo-actions">
            <button
              type="button"
              class="subtle photo-favorite"
              data-favorite-photo="${escapeHtml(item.id)}"
              aria-pressed="${Boolean(item.favorite)}"
            >${item.favorite ? '★ お気に入り' : '☆ お気に入り'}</button>

            <button
              type="button"
              class="subtle"
              data-edit-photo="${index}"
            >編集</button>

            <button
              type="button"
              class="del"
              data-delete="photos"
              data-index="${index}"
            >削除</button>
          </div>
        </div>
      </article>
    `;
  }).join('') || empty(
    db.photos.length
      ? '条件に合う生写真がありません。'
      : '生写真は未登録です。画像・メンバー・シリーズ・枚数を登録できます。'
  );

  list.querySelectorAll('[data-photo-id]').forEach(async (element) => {
    try {
      const url = await getPhotoURL(element.dataset.photoId);

      if (url && element.isConnected) {
        const image = new Image();
        image.src = url;
        image.alt = '登録した生写真';

        element.replaceChildren(image);
      }
    } catch {
      if (element.isConnected) {
        element.textContent = '画像を読み込めませんでした';
      }
    }
  });
}

function byRecordDate(items, newestFirst = false) {
  return [...items].sort((a, b) => {
    if (!a.date) return b.date ? 1 : 0;
    if (!b.date) return -1;

    const order =
      a.date.localeCompare(b.date) ||
      (a.time || '99:99').localeCompare(b.time || '99:99');

    return newestFirst ? -order : order;
  });
}

function rows(collection, items) {
  if (['schedule', 'lives', 'reports'].includes(collection)) {
    items = byRecordDate(items, collection !== 'schedule');
  }

  if (
    collection === 'tickets' &&
    typeof renderTicketRows === 'function'
  ) {
    return renderTicketRows(items);
  }

  return items.map((item) => {
    const index = db[collection].indexOf(item);

    const canEdit = [
      'schedule',
      'lives',
      'goods',
      'money',
      'todos',
      'places'
    ].includes(collection);

    const editButton = canEdit
      ? `
        <button
          type="button"
          class="subtle"
          data-edit-record="${collection}"
          data-index="${index}"
        >編集</button>
      `
      : '';

    const information = [
      item.date,
      collection === 'schedule' ? item.time : '',
      item.type,
      item.status,
      item.venue,
      item.note,
      item.amount ? `¥${Number(item.amount).toLocaleString()}` : ''
    ].filter(Boolean).join(' / ');

    const milestoneButton = ['reports', 'lives'].includes(collection)
      ? `
        <button
          type="button"
          class="subtle"
          data-create-milestone="${collection}"
          data-index="${index}"
        >記念日に追加</button>
      `
      : '';

    const doneCheckbox = collection === 'todos'
      ? `
        <input
          type="checkbox"
          aria-label="完了"
          data-done="${escapeHtml(item.id)}"
          ${item.done ? 'checked' : ''}
        >
      `
      : '';

    return `
      <div class="data-row">
        <div class="data-main">
          <strong>
            ${escapeHtml(item.title || item.member || '')}
          </strong>
          <small>${escapeHtml(information)}</small>
        </div>

        ${milestoneButton}
        ${doneCheckbox}
        ${editButton}

        <button
          type="button"
          class="del"
          data-delete="${collection}"
          data-index="${index}"
        >削除</button>
      </div>
    `;
  }).join('') || empty('まだ記録がありません');
}

function render() {
  renderPhotos();
  renderGoodsBrowser();
  renderHomeFavorites();

  for (const collection of collections.filter(
    (name) => !['photos', 'goods', 'milestones', 'reports'].includes(name)
  )) {
    renderRecordList(collection);
  }

  const today = new Date();

  const date = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  const end = new Date(today);
  end.setDate(end.getDate() + 7);

  const endDate = new Date(
    end.getTime() - end.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  const upcoming = db.schedule
    .filter((item) => item.date >= date)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || '99:99').localeCompare(b.time || '99:99')
    );

  $('#homeEvents').innerHTML = rows(
    'schedule',
    upcoming.slice(0, 5)
  );

  $('#homeTodos').innerHTML = rows(
    'todos',
    db.todos.filter((item) => !item.done).slice(0, 5)
  );

  $('#homeReports').innerHTML = rows(
    'reports',
    byRecordDate(db.reports, true).slice(0, 3)
  );

  $('#statEvents').textContent =
    `${upcoming.filter((item) => item.date < endDate).length}件`;

  $('#statDeadlines').textContent =
    `${db.tickets.filter(
      (item) =>
        item.date >= date &&
        !['落選', '入金済み'].includes(item.status)
    ).length}件`;

  $('#statReports').textContent = `${db.reports.length}件`;

  const spend = db.money
    .filter((item) => item.date?.startsWith(date.slice(0, 7)))
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  $('#moneyTotal').textContent =
    $('#statSpend').textContent = `¥${spend.toLocaleString()}`;

  const favorites = (db.profile.members || [db.profile.name])
    .map((name) => members.find((member) => member.name === name))
    .filter(Boolean);

  $('#profileName').textContent = favorites.length
    ? favorites.map((member) => member.name).join('・')
    : '推しメンバー';

  $('#profileGroup').textContent = db.profile.group;

  $('#favoriteDays').innerHTML = favorites.map((member) => {
    const start = db.profile.startDates?.[member.name];
    const days = supportingDays(start);

    return `
      <div class="favorite-days">
        <span>${escapeHtml(member.name)}</span>

        <strong>
          ${
            days == null
              ? '推し始めた日：未登録'
              : `推しメンにして${days.toLocaleString()}日が経過しました`
          }
        </strong>

        ${
          days == null
            ? ''
            : `<small>${escapeHtml(start.replaceAll('-', '/'))}から</small>`
        }
      </div>
    `;
  }).join('');

  $('#profileBirthdayText').textContent = favorites.length
    ? favorites.map((member) =>
        `${member.name} ${member.birthday.slice(5).replace('-', '/')}`
      ).join(' / ')
    : '未登録';

  $('#birthdayText').textContent = favorites.length
    ? favorites.map((member) => {
        const birthday = new Date(
          today.getFullYear(),
          Number(member.birthday.slice(5, 7)) - 1,
          Number(member.birthday.slice(8, 10))
        );

        const start = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );

        if (birthday < start) {
          birthday.setFullYear(birthday.getFullYear() + 1);
        }

        const remaining = Math.round(
          (birthday - start) / 86400000
        );

        return `${member.name} あと${remaining}日`;
      }).join(' / ')
    : '未登録';

  renderReports();
  renderMilestones();
}

function loadImages(container) {
  container.querySelectorAll('[data-memory-image]').forEach(
    async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.memoryImage);

        if (url && element.isConnected) {
          const image = new Image();
          image.src = url;
          image.alt = '記念日の写真';

          element.replaceChildren(image);
        }
      } catch {
        if (element.isConnected) {
          element.textContent = '画像を読み込めませんでした';
        }
      }
    }
  );
}

function milestoneCard(item, compact = false) {
  const index = db.milestones.indexOf(item);

  return `
    <article class="milestone-card">
      <time>${escapeHtml(item.date)}</time>
      <h3>${escapeHtml(item.title)}</h3>

      <p class="tag">
        ${escapeHtml((item.members || []).join('・'))}
      </p>

      <p class="anniversary">
        ${escapeHtml(anniversaryInfo(item.date))}
      </p>

      ${
        !compact && item.note
          ? `<p class="memory-note">${escapeHtml(item.note)}</p>`
          : ''
      }

      ${
        !compact && item.imageId
          ? `
            <div
              class="memory-image"
              data-memory-image="${escapeHtml(item.imageId)}"
            ></div>
          `
          : ''
      }

      <div class="photo-actions">
        <button
          type="button"
          class="subtle"
          data-edit-milestone="${index}"
        >編集</button>

        <button
          type="button"
          class="del"
          data-delete="milestones"
          data-index="${index}"
        >削除</button>
      </div>
    </article>
  `;
}

function renderMilestones() {
  options(
    '#milestoneMember',
    [
      ...members.map((member) => member.name),
      ...db.milestones.flatMap((item) => item.members || [])
    ],
    'すべてのメンバー'
  );

  const query = $('[data-search="milestones"]').value
    .trim()
    .toLowerCase();

  const filter = $('#milestoneMember').value;

  const items = [...db.milestones].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  $('#list-milestones').innerHTML = items
    .filter(
      (item) =>
        (!filter || (item.members || []).includes(filter)) &&
        [item.title, item.note, ...(item.members || [])]
          .join(' ')
          .toLowerCase()
          .includes(query)
    )
    .map((item) => milestoneCard(item))
    .join('') || empty('記念日は未登録です');

  const favorites = db.profile.members || [db.profile.name];

  const home = items
    .filter(
      (item) =>
        (item.members || []).some(
          (member) => favorites.includes(member)
        )
    )
    .sort((a, b) => {
      const aDays = daysToAnniversary(a.date);
      const bDays = daysToAnniversary(b.date);

      return (
        (aDays <= 30 ? aDays : Infinity) -
          (bDays <= 30 ? bDays : Infinity) ||
        b.date.localeCompare(a.date)
      );
    });

  $('#homeMilestones').innerHTML = home
    .slice(0, 3)
    .map((item) => milestoneCard(item, true))
    .join('') || empty('推しメンの記念日を登録すると表示されます');

  loadImages($('#list-milestones'));
}

function renderRecordList(collection) {
  if (collection === 'goods') {
    renderGoodsBrowser();
    return;
  }

  const list = $(`#list-${collection}`);

  if (!list || !Array.isArray(db[collection])) return;

  const query =
    $(`[data-search="${collection}"]`)?.value.trim().toLowerCase() || '';

  const filter =
    $(`[data-filter="${collection}"]`)?.value || '';

  list.innerHTML = rows(
    collection,
    db[collection].filter(
      (item) =>
        Object.values(item).join(' ').toLowerCase().includes(query) &&
        (!filter || item.type === filter || item.status === filter)
    )
  );
}

function renderReports() {
  const reportTerms = normalize(
    $('[data-search="reports"]').value
  ).split(/\s+/).filter(Boolean);

  const reports = byRecordDate(db.reports, true).filter((item) => {
    const kana = members.find(
      (member) => member.name === item.member
    )?.kana || '';

    const text = normalize(
      [
        item.member,
        kana,
        item.date,
        item.title,
        item.note,
        item.part,
        ...(item.messages || []).map((message) => message.text || '')
      ].join(' ')
    );

    return reportTerms.every((term) => text.includes(term));
  });

  $('#reportResults').textContent =
    `${reports.length}件を表示 / 全${db.reports.length}件`;

  $('#list-reports').innerHTML = reports
    .map((item) => reportCard(item, db.reports.indexOf(item)))
    .join('') || empty(
      db.reports.length
        ? '条件に合うレポはありません'
        : 'レポは未登録です'
    );

  loadReportImages($('#list-reports'));
}
