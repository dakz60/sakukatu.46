'use strict';

const placesState = {
  query: '',
  member: '',
  region: '',
  status: '',
  selected: '',
  detail: false,
  editing: null,
  visitId: null,
  busy: false
};

function placeKey(item) {
  return item.id != null
    ? String(item.id)
    : `legacy:${db.places.indexOf(item)}`;
}

function placeVisits(item) {
  return Array.isArray(item?.visits) ? item.visits : [];
}

function placeMembers(item) {
  return Array.isArray(item?.members) ? item.members : [];
}

function placeStatus(item) {
  return placeVisits(item).length ||
    ['visited', '訪問済み', '行った'].includes(item.status)
    ? 'visited'
    : 'want';
}

function selectedPlace() {
  return db.places.find((item) => placeKey(item) === placesState.selected);
}

function placeImageIds(item) {
  return [
    item?.imageId,
    ...placeVisits(item).flatMap((visit) =>
      Array.isArray(visit.imageIds) ? visit.imageIds : []
    )
  ].filter(Boolean);
}

function placeSafeURL(value) {
  try {
    const url = new URL(value);

    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function placeLink(url, label) {
  const safe = placeSafeURL(url);

  return safe
    ? `
      <a
        class="places-link"
        href="${escapeHtml(safe)}"
        target="_blank"
        rel="noopener noreferrer"
      >${escapeHtml(label)} ↗</a>
    `
    : '';
}

function placePhoto(id, className = '') {
  return `
    <span
      class="places-photo ${className}"
      ${id ? `data-place-image="${escapeHtml(id)}"` : ''}
    >
      <span>${id ? '読み込み中' : '⌖'}</span>
    </span>
  `;
}

function loadPlaceImages(container) {
  container.querySelectorAll('[data-place-image]').forEach(async (element) => {
    try {
      const url = await getPhotoURL(element.dataset.placeImage);

      if (!element.isConnected) return;

      if (!url) {
        element.textContent = '画像なし';
        return;
      }

      const image = new Image();
      image.alt = '場所・訪問記録の写真';
      image.src = url;

      element.replaceChildren(image);
    } catch {
      if (element.isConnected) {
        element.textContent = '画像を読み込めませんでした';
      }
    }
  });
}

function placeFilterOptions(selector, values, label, value) {
  const select = $(selector);

  select.replaceChildren(
    ...[['', label], ...values.map((text) => [text, text])].map(
      ([key, text]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = text;
        return option;
      }
    )
  );

  select.value = value;
}

function filteredPlaces() {
  const state = placesState;

  const terms = normalize(state.query).split(/\s+/).filter(Boolean);

  return db.places.filter((item) => {
    const related = placeMembers(item);

    const kana = related.map(
      (name) => members.find((member) => member.name === name)?.kana || ''
    );

    const text = normalize(
      [
        item.title,
        item.type,
        item.region,
        item.address,
        item.note,
        item.source,
        ...related,
        ...kana,
        ...placeVisits(item).flatMap((visit) => [visit.date, visit.note])
      ]
        .filter(Boolean)
        .join(' ')
    );

    return (
      (!state.member || related.includes(state.member)) &&
      (!state.region || item.region === state.region) &&
      (!state.status || placeStatus(item) === state.status) &&
      terms.every((term) => text.includes(term))
    );
  });
}

function renderPlaces() {
  if (!$('#placesContent')) return;

  const state = placesState;

  const names = [
    ...new Set([
      ...members.map((member) => member.name),
      ...db.places.flatMap(placeMembers)
    ])
  ];

  const regions = [
    ...new Set(db.places.map((item) => item.region).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, 'ja'));

  placeFilterOptions('#placesMember', names, 'すべてのメンバー', state.member);

  placeFilterOptions('#placesRegion', regions, 'すべての地域', state.region);

  $('#placesStatus').value = state.status;
  $('#placesSearch').value = state.query;

  const items = filteredPlaces();

  if (!items.some((item) => placeKey(item) === state.selected)) {
    state.selected = items[0] ? placeKey(items[0]) : '';
    state.detail = false;
  }

  $('#placesResults').textContent =
    `${items.length}件を表示 / 全${db.places.length}件`;

  $('#placesContent').classList.toggle('is-detail', state.detail);

  $('#placesList').innerHTML =
    items
      .map(
        (item) => `
    <button
      type="button"
      class="places-row ${
        placeKey(item) === state.selected ? 'is-selected' : ''
      }"
      data-place-open="${escapeHtml(placeKey(item))}"
      aria-pressed="${placeKey(item) === state.selected}"
    >
      ${placePhoto(item.imageId)}

      <span class="places-row-main">
        <strong>${escapeHtml(item.title || '名称未登録')}</strong>

        ${
          placeMembers(item).length
            ? `
              <span class="places-members">
                ${escapeHtml(placeMembers(item).join('・'))}
              </span>
            `
            : ''
        }

        <small>
          ${escapeHtml([item.region, item.type].filter(Boolean).join(' / '))}
        </small>

        <small>
          ${
            placeVisits(item).length ? `訪問 ${placeVisits(item).length}回` : ''
          }
        </small>
      </span>

      <span class="places-status">
        ${placeStatus(item) === 'visited' ? '訪問済み' : '行きたい'}
      </span>
    </button>
  `
      )
      .join('') ||
    empty(
      db.places.length
        ? '条件に合う場所はありません'
        : '「場所を追加」から、行きたい場所を登録できます'
    );

  renderPlaceDetail();
  loadPlaceImages($('#placesList'));
}

function renderPlaceDetail() {
  const item = selectedPlace();
  const container = $('#placesDetail');

  if (!item) {
    container.innerHTML = `
      <p class="empty">
        場所を選ぶと詳細と訪問記録を表示します。
      </p>
    `;
    return;
  }

  const destination = item.address || item.title || '';

  const mapURL =
    placeSafeURL(item.url) ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      destination
    )}`;

  const visits = placeVisits(item)
    .map((visit, index) => ({ visit, index }))
    .sort((a, b) =>
      String(b.visit.date || '').localeCompare(String(a.visit.date || ''))
    );

  container.innerHTML = `
    <button
      type="button"
      class="subtle places-back"
      data-place-action="back"
    >‹ 一覧へ</button>

    <div class="places-detail-head">
      <h3 tabindex="-1" id="placeDetailTitle">
        ${escapeHtml(item.title || '名称未登録')}
      </h3>

      <span class="places-status">
        ${placeStatus(item) === 'visited' ? '訪問済み' : '行きたい'}
      </span>
    </div>

    <p class="field-hint">
      ${escapeHtml([item.region, item.type].filter(Boolean).join(' / '))}
    </p>

    ${item.imageId ? placePhoto(item.imageId, 'places-cover') : ''}

    <dl class="places-info">
      <div>
        <dt>関連メンバー</dt>
        <dd>
          ${escapeHtml(placeMembers(item).join('・') || '未設定')}
        </dd>
      </div>

      <div>
        <dt>ゆかり・出典</dt>
        <dd>
          ${escapeHtml(item.source || '未設定')}
          ${placeLink(item.sourceUrl, '出典を見る')}
        </dd>
      </div>

      <div>
        <dt>住所</dt>
        <dd>${escapeHtml(item.address || '未設定')}</dd>
      </div>
    </dl>

    ${item.note ? `<p class="places-note">${escapeHtml(item.note)}</p>` : ''}

    <div class="places-links">
      ${placeLink(mapURL, 'Googleマップで開く')}
    </div>

    <div class="places-actions">
      <button
        type="button"
        class="subtle"
        data-place-action="edit"
      >場所を編集</button>

      <button
        type="button"
        class="del"
        data-place-action="delete"
      >場所を削除</button>
    </div>

    <div class="places-visits-head">
      <h4>自分の訪問記録</h4>

      <button
        type="button"
        class="subtle"
        data-place-action="visit"
      >＋ 訪問を記録</button>
    </div>

    <div id="placeVisitList">
      ${
        visits
          .map(
            ({ visit, index }) => `
          <article class="places-visit">
            <div class="places-visit-head">
              <time datetime="${escapeHtml(visit.date || '')}">
                ${escapeHtml(visit.date?.replaceAll('-', '/') || '日付未登録')}
              </time>

              <span class="places-actions">
                <button
                  type="button"
                  class="subtle"
                  data-place-visit-edit="${index}"
                >編集</button>

                <button
                  type="button"
                  class="del"
                  data-place-visit-delete="${index}"
                >削除</button>
              </span>
            </div>

            <div class="places-visit-images">
              ${(Array.isArray(visit.imageIds) ? visit.imageIds : [])
                .map((id) => placePhoto(id))
                .join('')}
            </div>

            ${
              visit.note
                ? `<p class="places-note">${escapeHtml(visit.note)}</p>`
                : ''
            }
          </article>
        `
          )
          .join('') || '<p class="field-hint">まだ訪問記録はありません。</p>'
      }
    </div>
  `;

  loadPlaceImages(container);
}

function commitPlaces(next) {
  const previous = db.places;
  db.places = next;

  try {
    save();
  } catch (error) {
    db.places = previous;

    console.error('場所を保存できませんでした', error);
    toast('保存できませんでした。登録内容は変更していません');
    return false;
  }

  return true;
}

function cleanupPlaceImages(ids) {
  for (const id of new Set(ids)) {
    if (!imageInUse(id)) {
      deletePhoto(id).catch(() => {});
    }
  }
}

let placeModalOpener = null;

function closePlaceModal(element) {
  if (placesState.busy) return;

  element.classList.remove('open');

  if (placeModalOpener?.isConnected) {
    placeModalOpener.focus({ preventScroll: true });
  } else {
    $('#placesSearch').focus({ preventScroll: true });
  }
}

function openPlaceForm(item = null) {
  if (placesState.busy) return;

  placesState.editing = item;
  placeModalOpener = document.activeElement;

  const form = $('#placeForm');
  form.reset();

  $('#placeFormTitle').textContent = item ? '場所を編集' : '場所を追加';

  for (const name of [
    'title',
    'type',
    'region',
    'address',
    'url',
    'source',
    'sourceUrl',
    'note'
  ]) {
    form.elements[name].value =
      item?.[name] || (name === 'type' ? '聖地巡礼' : '');
  }

  form.elements.status.value = item ? placeStatus(item) : 'want';

  form.elements.removeImage.closest('label').hidden = !item?.imageId;

  form.elements.status.disabled = !!placeVisits(item).length;

  $('#placeMembers').innerHTML =
    '<legend>関連メンバー（複数選択可）</legend>' +
    [
      ...new Set([
        ...members.map((member) => member.name),
        ...placeMembers(item)
      ])
    ]
      .map(
        (name) => `
      <label>
        <input
          type="checkbox"
          name="members"
          value="${escapeHtml(name)}"
          ${placeMembers(item).includes(name) ? 'checked' : ''}
        >
        ${escapeHtml(name)}
      </label>
    `
      )
      .join('');

  $('#placeCurrentImage').innerHTML = item?.imageId
    ? placePhoto(item.imageId)
    : '';

  loadPlaceImages($('#placeCurrentImage'));

  $('#placeModal').classList.add('open');
  form.elements.title.focus();
}

function openVisitForm(index = null) {
  const item = selectedPlace();

  if (!item || placesState.busy) return;

  placesState.editing = item;
  placeModalOpener = document.activeElement;
  placesState.visitId = index;

  const visit = index === null ? null : placeVisits(item)[index];

  const form = $('#placeVisitForm');
  form.reset();

  const today = new Date();

  form.elements.date.value =
    visit?.date ||
    new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);

  form.elements.note.value = visit?.note || '';

  $('#placeVisitFormTitle').textContent =
    index === null ? '訪問を記録' : '訪問記録を編集';

  form.elements.removeImages.closest('label').hidden = !visit?.imageIds?.length;

  $('#placeVisitCurrentImages').innerHTML = (visit?.imageIds || [])
    .map((id) => placePhoto(id))
    .join('');

  loadPlaceImages($('#placeVisitCurrentImages'));

  $('#placeVisitModal').classList.add('open');
  form.elements.date.focus();
}

async function savePlaceImages(files, ids) {
  for (const file of files) {
    if (!file.size || (file.type && !file.type.startsWith('image/'))) {
      throw new Error('画像ファイルを選んでください');
    }

    const url = URL.createObjectURL(file);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }

    const id = `place-image-${crypto.randomUUID()}`;
    ids.push(id);

    await savePhoto(id, file, { compress: true });
  }
}

async function submitPlaceForm(event) {
  event.preventDefault();

  if (placesState.busy) return;

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const original = placesState.editing;

  if (original && !db.places.includes(original)) {
    toast('場所を開き直してください');
    return;
  }

  const item = {
    ...original,
    id: original?.id ?? crypto.randomUUID()
  };

  for (const name of [
    'title',
    'type',
    'region',
    'address',
    'url',
    'source',
    'sourceUrl',
    'note'
  ]) {
    item[name] = form.elements[name].value.trim();
  }

  if (!item.title) {
    toast('場所名を入力してください');
    return;
  }

  for (const name of ['url', 'sourceUrl']) {
    if (item[name] && !placeSafeURL(item[name])) {
      toast('リンクはhttpまたはhttpsのURLを入力してください');
      return;
    }
  }

  item.members = [...form.querySelectorAll('[name="members"]:checked')].map(
    (input) => input.value
  );

  item.status = placeVisits(item).length
    ? 'visited'
    : form.elements.status.value;

  if (!['want', 'visited'].includes(item.status)) {
    toast('訪問状態を選んでください');
    return;
  }

  await savePlaceChange(
    form,
    original,
    item,
    async (ids) => {
      const file = form.elements.photo.files[0];

      if (file) {
        await savePlaceImages([file], ids);
        item.imageId = ids[0];
      } else if (form.elements.removeImage.checked) {
        delete item.imageId;
      }
    },
    '#placeModal'
  );
}

async function submitVisitForm(event) {
  event.preventDefault();

  if (placesState.busy) return;

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const original = placesState.editing;

  if (!original || !db.places.includes(original)) {
    toast('場所を開き直してください');
    return;
  }

  const date = form.elements.date.value;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    toast('訪問日を入力してください');
    return;
  }

  const visits = [...placeVisits(original)];
  const index = placesState.visitId;
  const previous = index === null ? null : visits[index];

  if (index !== null && !previous) {
    toast('訪問記録を開き直してください');
    return;
  }

  const files = [...form.elements.photos.files];

  const retained = form.elements.removeImages.checked
    ? []
    : [...(previous?.imageIds || [])];

  if (retained.length + files.length > 5) {
    toast('1回の訪問につき写真は5枚までです');
    return;
  }

  const item = {
    ...original,
    id: original.id ?? crypto.randomUUID(),
    status: 'visited',
    visits
  };

  await savePlaceChange(
    form,
    original,
    item,
    async (ids) => {
      await savePlaceImages(files, ids);

      const visit = {
        ...previous,
        id: previous?.id ?? crypto.randomUUID(),
        date,
        note: form.elements.note.value.trim(),
        imageIds: [...retained, ...ids]
      };

      if (index === null) {
        visits.unshift(visit);
      } else {
        visits[index] = visit;
      }
    },
    '#placeVisitModal'
  );
}

async function savePlaceChange(form, original, item, prepare, modalId) {
  placesState.busy = true;

  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;

  const ids = [];
  let persisted = false;

  try {
    await prepare(ids);

    const next = original
      ? db.places.map((row) => (row === original ? item : row))
      : [item, ...db.places];

    persisted = commitPlaces(next);

    if (!persisted) return;

    placesState.selected = String(item.id);
    placesState.detail = true;
    placesState.query = '';
    placesState.member = '';
    placesState.region = '';
    placesState.status = '';

    $(modalId).classList.remove('open');

    renderPlaces();
    cleanupPlaceImages(placeImageIds(original));

    toast('保存しました');
  } catch (error) {
    console.error('場所・訪問記録の保存に失敗しました', error);

    toast(
      persisted
        ? '保存済みです。再読み込みしてください'
        : `保存できませんでした：${error.message || '不明なエラー'}`
    );
  } finally {
    if (!persisted) {
      cleanupPlaceImages(ids);
    }

    placesState.busy = false;
    submit.disabled = false;
  }
}

function deletePlace() {
  const item = selectedPlace();

  if (!item || !confirm('この場所と訪問記録を削除しますか？')) {
    return;
  }

  const ids = placeImageIds(item);

  if (commitPlaces(db.places.filter((row) => row !== item))) {
    placesState.detail = false;

    renderPlaces();
    cleanupPlaceImages(ids);

    toast('場所を削除しました');
  }
}

function deletePlaceVisit(index) {
  const item = selectedPlace();
  const visit = placeVisits(item)[index];

  if (
    !visit ||
    !confirm('この訪問記録を削除しますか？場所の情報は残ります。')
  ) {
    return;
  }

  const next = {
    ...item,
    visits: placeVisits(item).filter((_, position) => position !== index)
  };

  if (commitPlaces(db.places.map((row) => (row === item ? next : row)))) {
    renderPlaces();
    cleanupPlaceImages(visit.imageIds || []);

    toast('訪問記録を削除しました');
  }
}

function initPlaces() {
  const page = $('#page-places');

  if ($('#placesContent')) return;

  page.querySelector('.page-head p').textContent =
    'メンバーゆかりの場所と、自分の訪問記録。';

  const add = page.querySelector('[data-add="places"]');
  add.removeAttribute('data-add');
  add.dataset.placeAction = 'add';
  add.textContent = '＋ 場所を追加';

  page.querySelector('.panel').innerHTML = `
    <div class="places-filters">
      <input
        type="search"
        class="search"
        id="placesSearch"
        aria-label="場所・メモを検索"
        placeholder="場所・メモを検索"
      >

      <label>
        メンバー
        <select class="filter" id="placesMember"></select>
      </label>

      <label>
        地域
        <select class="filter" id="placesRegion"></select>
      </label>

      <label>
        訪問状態
        <select class="filter" id="placesStatus">
          <option value="">すべて</option>
          <option value="want">行きたい</option>
          <option value="visited">訪問済み</option>
        </select>
      </label>

      <button
        type="button"
        class="subtle"
        data-place-action="reset"
      >絞り込みを解除</button>
    </div>

    <p
      id="placesResults"
      class="field-hint"
      aria-live="polite"
    ></p>

    <div class="places-content" id="placesContent">
      <div class="places-list" id="placesList"></div>

      <section
        class="places-detail"
        id="placesDetail"
        aria-label="場所の詳細"
      ></section>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'placeModal';
  modal.className = 'modal-wrap';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'placeFormTitle');

  modal.innerHTML = `
    <div class="modal">
      <h3 id="placeFormTitle">場所を追加</h3>

      <form id="placeForm">
        <div class="form-grid">
          <div class="field full">
            <label for="placeTitle">場所名 *</label>
            <input
              name="title"
              id="placeTitle"
              maxlength="160"
              required
            >
          </div>

          <div class="field">
            <label for="placeType">種類</label>
            <input
              name="type"
              id="placeType"
              list="placeTypeChoices"
              maxlength="80"
            >
            <datalist id="placeTypeChoices">
              <option>ライブ会場</option>
              <option>聖地巡礼</option>
              <option>お店</option>
              <option>カフェ</option>
              <option>ロケ地</option>
              <option>その他</option>
            </datalist>
          </div>

          <div class="field">
            <label for="placeRegion">地域</label>
            <input
              name="region"
              id="placeRegion"
              maxlength="80"
              placeholder="東京都、大阪府など"
            >
          </div>

          <div class="field full">
            <label for="placeAddress">住所</label>
            <input
              name="address"
              id="placeAddress"
              maxlength="300"
            >
          </div>

          <div class="field full">
            <label for="placeURL">地図リンク（任意）</label>
            <input
              type="url"
              name="url"
              id="placeURL"
              placeholder="https://..."
            >
          </div>

          <div class="field full">
            <fieldset
              id="placeMembers"
              class="member-checkboxes"
            ></fieldset>
            <small>
              関連するメンバーを複数選べます。
              選ばずに登録することもできます。
            </small>
          </div>

          <div class="field full">
            <label for="placeSource">ゆかり・出典の説明</label>
            <input
              name="source"
              id="placeSource"
              maxlength="500"
              placeholder="番組名・ブログ・MVなど"
            >
          </div>

          <div class="field full">
            <label for="placeSourceURL">出典URL（任意）</label>
            <input
              type="url"
              name="sourceUrl"
              id="placeSourceURL"
              placeholder="https://..."
            >
          </div>

          <div class="field">
            <label for="placeStatus">訪問状態</label>
            <select name="status" id="placeStatus">
              <option value="want">行きたい</option>
              <option value="visited">訪問済み</option>
            </select>
            <small>
              訪問記録がある場所は訪問済みになります。
            </small>
          </div>

          <div class="field full">
            <label for="placePhoto">場所の写真（任意）</label>
            <input
              type="file"
              name="photo"
              id="placePhoto"
              accept="image/*"
            >

            <div
              id="placeCurrentImage"
              class="places-form-images"
            ></div>

            <label hidden>
              <input type="checkbox" name="removeImage">
              現在の写真を外す
            </label>
          </div>

          <div class="field full">
            <label for="placeNote">メモ</label>
            <textarea name="note" id="placeNote"></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary"
            data-place-close
          >キャンセル</button>

          <button
            type="submit"
            class="primary"
          >保存する</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(modal);

  const visitModal = document.createElement('div');
  visitModal.id = 'placeVisitModal';
  visitModal.className = 'modal-wrap';
  visitModal.setAttribute('role', 'dialog');
  visitModal.setAttribute('aria-modal', 'true');
  visitModal.setAttribute('aria-labelledby', 'placeVisitFormTitle');

  visitModal.innerHTML = `
    <div class="modal">
      <h3 id="placeVisitFormTitle">訪問を記録</h3>

      <form id="placeVisitForm">
        <div class="form-grid">
          <div class="field full">
            <label for="placeVisitDate">訪問日 *</label>
            <input
              type="date"
              name="date"
              id="placeVisitDate"
              required
            >
          </div>

          <div class="field full">
            <label for="placeVisitPhotos">写真（最大5枚）</label>
            <input
              type="file"
              name="photos"
              id="placeVisitPhotos"
              accept="image/*"
              multiple
            >

            <small>
              画像を選ばなければ現在の写真を保持します。
              選んだ画像は追加します。
            </small>

            <div
              id="placeVisitCurrentImages"
              class="places-form-images"
            ></div>

            <label hidden>
              <input type="checkbox" name="removeImages">
              現在の写真をすべて外す
            </label>
          </div>

          <div class="field full">
            <label for="placeVisitNote">感想・メモ</label>
            <textarea
              name="note"
              id="placeVisitNote"
            ></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary"
            data-place-close
          >キャンセル</button>

          <button
            type="submit"
            class="primary"
          >保存する</button>
        </div>
      </form>
    </div>
  `;

  document.body.append(visitModal);

  $('#placeForm').onsubmit = submitPlaceForm;
  $('#placeVisitForm').onsubmit = submitVisitForm;

  for (const element of [modal, visitModal]) {
    element.addEventListener('click', (event) => {
      if (
        !placesState.busy &&
        (event.target === element || event.target.closest('[data-place-close]'))
      ) {
        closePlaceModal(element);
      }
    });

    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePlaceModal(element);
      }

      if (event.key !== 'Tab') return;

      const controls = [
        ...element.querySelectorAll('button, input, select, textarea, a[href]')
      ].filter((input) => !input.disabled && input.getClientRects().length);

      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }

  $('#placesSearch').oninput = (event) => {
    placesState.query = event.target.value;
    renderPlaces();
  };

  for (const [selector, key] of [
    ['#placesMember', 'member'],
    ['#placesRegion', 'region'],
    ['#placesStatus', 'status']
  ]) {
    $(selector).onchange = (event) => {
      placesState[key] = event.target.value;
      placesState.detail = false;
      renderPlaces();
    };
  }

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button');

    if (!button || placesState.busy) return;

    if (button.hasAttribute('data-place-open')) {
      placesState.selected = button.dataset.placeOpen;
      placesState.detail = true;

      renderPlaces();
      $('#placeDetailTitle')?.focus();
    } else if (button.hasAttribute('data-place-visit-edit')) {
      openVisitForm(Number(button.dataset.placeVisitEdit));
    } else if (button.hasAttribute('data-place-visit-delete')) {
      deletePlaceVisit(Number(button.dataset.placeVisitDelete));
    } else {
      const action = button.dataset.placeAction;

      if (action === 'add') {
        openPlaceForm();
      }

      if (action === 'edit') {
        openPlaceForm(selectedPlace());
      }

      if (action === 'delete') {
        deletePlace();
      }

      if (action === 'visit') {
        openVisitForm();
      }

      if (action === 'back') {
        placesState.detail = false;

        renderPlaces();
        $('#placesSearch').focus({ preventScroll: true });
      }

      if (action === 'reset') {
        Object.assign(placesState, {
          query: '',
          member: '',
          region: '',
          status: '',
          detail: false
        });

        renderPlaces();
      }
    }
  });

  renderPlaces();
}
