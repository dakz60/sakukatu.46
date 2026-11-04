'use strict';

const photoBrowserState = {
  member: '',
  seriesId: '',
  query: '',
  year: '',
  onlyMissing: false
};

const standardPhotoPoses = ['スワリ', 'ヨリ', 'チュウ', 'ヒキ'];

const photoInventory = () =>
  photoView === 'owned' ? 'collection' : photoView;

const photoInventoryLabel = (inventory) =>
  ({ collection: '所持', offer: '提供', want: '希望' })[inventory];

function photoSeriesId(title, occurrence) {
  return `${encodeURIComponent(title)}:${occurrence}`;
}

function memberPhotoSeries(name) {
  const seen = new Map();
  const source = photoCatalogSource[name] || [];
  const totals = new Map();

  for (const title of source) {
    totals.set(title, (totals.get(title) || 0) + 1);
  }

  const entries = source.map((title) => {
    const occurrence = (seen.get(title) || 0) + 1;
    seen.set(title, occurrence);

    return {
      id: photoSeriesId(title, occurrence),
      title,
      occurrence,
      duplicate: totals.get(title) > 1
    };
  });

  for (const item of db.photos.filter((item) => item.member === name)) {
    if (entries.some((entry) => entry.title === item.series)) continue;

    const title = item.series || 'シリーズ未設定';

    if (!entries.some((entry) => entry.title === title)) {
      entries.push({
        id: photoSeriesId(title, 1),
        title,
        occurrence: 1,
        custom: true
      });
    }
  }

  return entries;
}

function seriesPhotoRecords(name, entry, inventory = photoInventory()) {
  return db.photos.filter(
    (item) =>
      item.member === name &&
      item.inventory === inventory &&
      (
        item.catalogId
          ? item.catalogId === entry.id
          : !entry.duplicate && item.series === entry.title
      )
  );
}

function photoSeriesPoses(name, entry) {
  const configured = db.photoCatalogPoses?.[name]?.[entry.id];
  const saved = db.photoCatalogCustom?.[name]?.[entry.id] || [];
  const hidden = db.photoCatalogHiddenPoses?.[name]?.[entry.id] || [];

  const existing = db.photos
    .filter(
      (item) =>
        item.member === name &&
        (
          item.catalogId === entry.id ||
          (!entry.duplicate && item.series === entry.title)
        )
    )
    .map((item) => item.pose)
    .filter(Boolean);

  const base = Array.isArray(configured)
    ? configured
    : standardPhotoPoses;

  return [
    ...new Set([
      ...base,
      ...(Array.isArray(configured) ? [] : saved),
      ...existing
    ])
  ].filter(
    (value) =>
      typeof value === 'string' &&
      value.trim() &&
      !hidden.includes(value)
  );
}

function storePhotoPoses(poses, rename = null, hidden = null) {
  const name = photoBrowserState.member;
  const entry = currentPhotoSeries();

  if (!entry) return false;

  const previousPoses = db.photoCatalogPoses;
  const previousPhotos = db.photos;
  const previousHidden = db.photoCatalogHiddenPoses;

  db.photoCatalogPoses = {
    ...previousPoses,
    [name]: {
      ...previousPoses?.[name],
      [entry.id]: poses
    }
  };

  if (hidden) {
    db.photoCatalogHiddenPoses = {
      ...previousHidden,
      [name]: {
        ...previousHidden?.[name],
        [entry.id]: hidden
      }
    };
  }

  if (rename) {
    db.photos = db.photos.map((item) => {
      const matches =
        item.member === name &&
        (
          item.catalogId === entry.id ||
          (!entry.duplicate && item.series === entry.title)
        );

      return matches && item.pose === rename.from
        ? { ...item, pose: rename.to }
        : item;
    });
  }

  try {
    save();
  } catch {
    db.photoCatalogPoses = previousPoses;
    db.photos = previousPhotos;
    db.photoCatalogHiddenPoses = previousHidden;

    toast('種類を保存できませんでした');
    return false;
  }

  render();
  return true;
}

function editPhotoPose(pose) {
  const entry = currentPhotoSeries();
  if (!entry) return;

  const value = prompt('新しい種類名を入力してください', pose);
  if (value === null) return;

  const next = value.trim();
  const poses = photoSeriesPoses(photoBrowserState.member, entry);

  if (!next || next.length > 80) {
    toast('種類名は1〜80文字で入力してください');
    return;
  }

  if (next === pose) return;

  if (poses.includes(next)) {
    toast('その種類名は使用済みです');
    return;
  }

  const records = ['collection', 'offer', 'want'].flatMap(
    (inventory) =>
      seriesPhotoRecords(photoBrowserState.member, entry, inventory)
  );

  if (records.some((item) => item.pose === next)) {
    toast('その名前の登録が残っています。「種類を追加」から再表示できます');
    return;
  }

  if (
    storePhotoPoses(
      poses.map((value) => value === pose ? next : value),
      { from: pose, to: next }
    )
  ) {
    toast('種類名を変更しました');
  }
}

function removePhotoPose(pose) {
  const entry = currentPhotoSeries();
  if (!entry) return;

  if (
    !confirm(
      `「${pose}」を種類一覧から外しますか？登録済みの写真・枚数は削除せず、登録済み一覧に残します。`
    )
  ) {
    return;
  }

  const hidden = [
    ...new Set([
      ...(db.photoCatalogHiddenPoses?.[photoBrowserState.member]?.[entry.id] || []),
      pose
    ])
  ];

  if (
    storePhotoPoses(
      photoSeriesPoses(photoBrowserState.member, entry)
        .filter((value) => value !== pose),
      null,
      hidden
    )
  ) {
    toast('種類を一覧から外しました');
  }
}

let photoSeriesIconBusy = false;

function photoSeriesThumbnail(member, entry) {
  const icon = db.photoSeriesIcons?.[member]?.[entry.id];

  return `<span class="catalog-series-thumb"${
    icon?.imageId
      ? ` data-series-thumbnail="${escapeHtml(icon.imageId)}" data-series-crop="${escapeHtml(JSON.stringify(icon.crop || null))}"`
      : ''
  } aria-hidden="true">▧</span>`;
}

function loadSeriesThumbnails(container) {
  container.querySelectorAll('[data-series-thumbnail]').forEach(
    async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.seriesThumbnail);

        if (!url || !element.isConnected) return;

        const image = new Image();
        image.alt = '';

        image.onload = () => {
          if (!element.isConnected) return;

          let crop = null;

          try {
            crop = JSON.parse(element.dataset.seriesCrop || 'null');
          } catch {}

          applyAvatarCrop(image, crop);
        };

        image.src = url;
        element.replaceChildren(image);
      } catch {}
    }
  );
}

function storeSeriesIcon(member, seriesId, icon) {
  const previous = db.photoSeriesIcons;
  const memberIcons = { ...previous?.[member] };

  if (icon) {
    memberIcons[seriesId] = icon;
  } else {
    delete memberIcons[seriesId];
  }

  db.photoSeriesIcons = {
    ...previous,
    [member]: memberIcons
  };

  try {
    save();
  } catch (error) {
    db.photoSeriesIcons = previous;
    throw error;
  }
}

function deleteUnusedSeriesIcon(id) {
  if (id?.startsWith('series-icon-') && !imageInUse(id)) {
    deletePhoto(id).catch(() => {});
  }
}

function renderSeriesIconEditor() {
  let controls = $('#photoSeriesIconEditor');

  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'photoSeriesIconEditor';
    controls.className = 'catalog-icon-editor';

    $('#photoCatalogSummary').before(controls);

    controls.addEventListener('click', (event) => {
      const button = event.target.closest('[data-series-icon-action]');

      if (!button || photoSeriesIconBusy) return;

      if (button.dataset.seriesIconAction === 'choose') {
        $('#photoSeriesIconFile').click();
      } else if (button.dataset.seriesIconAction === 'crop') {
        editSeriesIcon();
      } else if (button.dataset.seriesIconAction === 'remove') {
        removeSeriesIcon();
      }
    });

    controls.addEventListener('change', (event) => {
      if (event.target.id !== 'photoSeriesIconFile') return;

      const file = event.target.files[0];
      event.target.value = '';

      if (file) editSeriesIcon(file);
    });
  }

  const entry = currentPhotoSeries();
  controls.hidden = !entry;

  if (!entry) return;

  const icon =
    db.photoSeriesIcons?.[photoBrowserState.member]?.[entry.id];

  controls.innerHTML = `
    ${photoSeriesThumbnail(photoBrowserState.member, entry)}

    <span class="catalog-icon-caption">シリーズのアイコン</span>

    <input
      type="file"
      id="photoSeriesIconFile"
      accept="image/*"
      aria-label="シリーズのアイコン画像"
      hidden
    >

    <button
      type="button"
      class="secondary"
      data-series-icon-action="choose"
    >${icon?.imageId ? '画像を変更' : '画像を選ぶ'}</button>

    <button
      type="button"
      class="secondary"
      data-series-icon-action="crop"
      ${!icon?.imageId ? 'disabled' : ''}
    >切り取り</button>

    <button
      type="button"
      class="subtle"
      data-series-icon-action="remove"
      ${!icon?.imageId ? 'disabled' : ''}
    >解除</button>
  `;

  if (photoSeriesIconBusy) {
    controls.querySelectorAll('input, button').forEach((element) => {
      element.disabled = true;
    });
  }

  loadSeriesThumbnails(controls);
}

async function editSeriesIcon(file = null) {
  if (photoSeriesIconBusy) return;

  const member = photoBrowserState.member;
  const entry = currentPhotoSeries();

  if (!entry) return;

  if (file && !file.type.startsWith('image/')) {
    toast('画像ファイルを選んでください');
    return;
  }

  const previous = db.photoSeriesIcons?.[member]?.[entry.id];

  photoSeriesIconBusy = true;

  let newId;
  let persisted = false;

  renderSeriesIconEditor();

  try {
    const source = file || (
      previous?.imageId
        ? await getPhotoURL(previous.imageId)
        : null
    );

    if (!source) {
      toast('アイコン画像を選んでください');
      return;
    }

    const crop = await chooseImageCrop(source, {
      round: true,
      initialCrop: file ? null : previous.crop
    });

    if (!crop) return;

    if (file) {
      newId = `series-icon-${crypto.randomUUID()}`;
      await savePhoto(newId, file);
    }

    storeSeriesIcon(member, entry.id, {
      imageId: newId || previous.imageId,
      crop
    });

    persisted = true;
    renderPhotoBrowser();

    if (newId) {
      deleteUnusedSeriesIcon(previous?.imageId);
    }

    toast('シリーズのアイコンを保存しました');
  } catch {
    if (newId && !persisted) {
      deletePhoto(newId).catch(() => {});
    }

    toast('アイコンを保存できませんでした。画像と空き容量を確認してください');
  } finally {
    photoSeriesIconBusy = false;
    renderSeriesIconEditor();
  }
}

function removeSeriesIcon() {
  if (photoSeriesIconBusy) return;

  const member = photoBrowserState.member;
  const entry = currentPhotoSeries();
  const previous = entry && db.photoSeriesIcons?.[member]?.[entry.id];

  if (!previous?.imageId) return;

  if (
    !confirm(
      'シリーズのアイコンを解除しますか？登録済みの写真・枚数は変更しません。'
    )
  ) {
    return;
  }

  try {
    storeSeriesIcon(member, entry.id, null);
  } catch {
    toast('アイコンの解除を保存できませんでした');
    return;
  }

  renderPhotoBrowser();
  deleteUnusedSeriesIcon(previous.imageId);

  toast('アイコンを解除しました');
}

function photoPoseCount(records, pose) {
  return records
    .filter((item) => item.pose === pose)
    .reduce((total, item) => total + photoCount(item), 0);
}

function currentPhotoSeries() {
  return memberPhotoSeries(photoBrowserState.member).find(
    (entry) => entry.id === photoBrowserState.seriesId
  );
}

function photoDefaults(entry, pose, inventory = photoInventory()) {
  return {
    member: photoBrowserState.member,
    series: entry.title,
    pose,
    inventory,
    count: 1,
    category: /封入$/.test(entry.title) ? 'CD封入' : '公式ランダム',
    catalogId: entry.id
  };
}

function requestPhotoForm(entry, pose, inventory = photoInventory()) {
  const records = seriesPhotoRecords(
    photoBrowserState.member,
    entry,
    inventory
  ).filter((item) => item.pose === pose);

  const item =
    records.find((item) => photoCount(item) > 0) || records[0];

  document.dispatchEvent(new CustomEvent('photoformrequest', {
    detail: {
      item,
      defaults: photoDefaults(entry, pose, inventory)
    }
  }));
}

function openPhotoCatalogRecord(item) {
  photoBrowserState.member = item.member;

  const entry = memberPhotoSeries(item.member).find((entry) =>
    item.catalogId
      ? entry.id === item.catalogId
      : !entry.duplicate && entry.title === item.series
  );

  photoBrowserState.seriesId = entry?.id || '';
  photoBrowserState.query = '';
  photoBrowserState.year = '';

  renderPhotos();
  $('#savedPhotos').open = true;
}

function renderPhotoBrowser() {
  renderSeriesIconEditor();

  const state = photoBrowserState;
  const inventory = photoInventory();
  const member = state.member;
  const entry = member && currentPhotoSeries();

  if (state.seriesId && !entry) {
    state.seriesId = '';
  }

  $('#photoBrowserBack').hidden = !member;
  $('#photoBrowserBack').textContent = entry
    ? '‹ 衣装・シリーズへ'
    : '‹ メンバーへ';

  $('#photoBrowserTitle').textContent =
    entry ? entry.title : member || 'メンバーを選ぶ';

  $('#photoBrowserCrumb').textContent = entry
    ? `${member} / ${photoInventoryLabel(inventory)}`
    : '生写真コレクション';

  const search = $('#photoCatalogSearch');

  search.hidden = !!entry;
  search.placeholder = member
    ? '衣装・シリーズを検索'
    : 'メンバーを検索';

  search.setAttribute('aria-label', search.placeholder);

  if (search.value !== state.query) {
    search.value = state.query;
  }

  const years = member && !entry
    ? [
        ...new Set(
          memberPhotoSeries(member).flatMap(
            (item) => item.title.match(/20\d{2}/g) || []
          )
        )
      ].sort().reverse()
    : [];

  $('#photoCatalogYearField').hidden = !member || !!entry;

  const yearSelect = $('#photoCatalogYear');

  yearSelect.replaceChildren(
    ...[
      ['', 'すべての年'],
      ...years.map((year) => [year, year]),
      ['unknown', '年の記載なし']
    ].map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    })
  );

  yearSelect.value = state.year;

  $('#photoCatalogMissingLabel').hidden =
    !member || !!entry || inventory !== 'collection';

  $('#photoCatalogMissing').checked = state.onlyMissing;
  $('#photoCustomPoseForm').hidden = !entry;
  $('#photoCatalogAdd').hidden = !member;

  $('#photoCatalogAdd').textContent = entry
    ? '＋ このシリーズの写真を登録'
    : '＋ 一覧にない写真を登録';

  const container = $('#photoCatalogContent');
  container.classList.toggle('pose-grid', !!entry);

  if (!member) {
    const names = [
      ...new Set([
        ...members.map((item) => item.name),
        ...Object.keys(photoCatalogSource),
        ...db.photos.map((item) => item.member).filter(Boolean)
      ])
    ];

    const visible = names.filter((name) =>
      normalize(
        `${name} ${members.find((item) => item.name === name)?.kana || ''}`
      ).includes(normalize(state.query))
    );

    $('#photoCatalogSummary').textContent = `${visible.length}人`;

    container.innerHTML = visible.map((name) => {
      const count = db.photos
        .filter(
          (item) =>
            item.member === name &&
            item.inventory === inventory
        )
        .reduce((sum, item) => sum + photoCount(item), 0);

      return `
        <button
          type="button"
          class="catalog-member"
          data-catalog-member="${escapeHtml(name)}"
        >
          <span class="catalog-initial" aria-hidden="true">
            ${escapeHtml(name.slice(0, 1))}
          </span>

          <span>
            <strong>${escapeHtml(name)}</strong>
            <small>
              ${memberPhotoSeries(name).length}シリーズ /
              ${photoInventoryLabel(inventory)} ${count}枚
            </small>
          </span>

          <span aria-hidden="true">›</span>
        </button>
      `;
    }).join('') || empty('メンバーが見つかりません');

    return;
  }

  if (!entry) {
    const all = memberPhotoSeries(member);

    const visible = all.filter((item) => {
      const itemYears = item.title.match(/20\d{2}/g) || [];
      const poses = photoSeriesPoses(member, item);
      const records = seriesPhotoRecords(member, item);

      const matchesQuery =
        normalize(item.title).includes(normalize(state.query));

      const matchesYear = !state.year || (
        state.year === 'unknown'
          ? !itemYears.length
          : itemYears.includes(state.year)
      );

      const matchesMissing =
        !state.onlyMissing ||
        inventory !== 'collection' ||
        poses.some((pose) => photoPoseCount(records, pose) === 0);

      return matchesQuery && matchesYear && matchesMissing;
    });

    $('#photoCatalogSummary').textContent =
      `${visible.length} / ${all.length}シリーズ`;

    container.innerHTML = visible.map((item) => {
      const records = seriesPhotoRecords(member, item);
      const poses = photoSeriesPoses(member, item);

      const complete = poses.filter(
        (pose) => photoPoseCount(records, pose) > 0
      ).length;

      const chips = poses.map((pose) => `
        <span class="pose-chip ${
          photoPoseCount(records, pose) > 0 ? 'is-owned' : ''
        }">${escapeHtml(pose)}</span>
      `).join('') || '<span class="pose-chip">種類を登録</span>';

      return `
        <button
          type="button"
          class="catalog-series"
          data-catalog-series="${escapeHtml(item.id)}"
        >
          ${photoSeriesThumbnail(member, item)}

          <span class="catalog-series-main">
            <strong>${escapeHtml(item.title)}</strong>

            ${
              item.duplicate
                ? `<small>同名項目 ${item.occurrence}（原文の順番）</small>`
                : ''
            }

            <small>
              ${photoInventoryLabel(inventory)}
              ${complete} / ${poses.length}種類
            </small>

            <span class="pose-chips">${chips}</span>
          </span>

          <span aria-hidden="true">›</span>
        </button>
      `;
    }).join('') || empty('条件に合うシリーズはありません');

    loadSeriesThumbnails(container);
    return;
  }

  const records = seriesPhotoRecords(member, entry);
  const poses = photoSeriesPoses(member, entry);

  const complete = poses.filter(
    (pose) => photoPoseCount(records, pose) > 0
  ).length;

  $('#photoCatalogSummary').textContent =
    `${photoInventoryLabel(inventory)} ${complete} / ${poses.length}種類` +
    (entry.duplicate ? ' · 同名の別項目とは分けて管理' : '');

  container.innerHTML = poses.map((pose) => {
    const items = records.filter((item) => item.pose === pose);
    const count = photoPoseCount(records, pose);

    const item = items.find((item) => item.imageId) || items[0];
    const favorite = items.find((item) => item.favorite) || items[0];

    const key = escapeHtml(pose);
    const label = escapeHtml(`${member} ${entry.title} ${pose}`);

    const imageContent = item
      ? `<span data-catalog-image="${escapeHtml(item.imageId || item.id)}">${
          count ? '写真を登録' : '未登録'
        }</span>`
      : `<span>${inventory === 'collection' ? '未所持' : '未登録'}</span>`;

    return `
      <article class="catalog-pose" data-catalog-pose="${key}">
        <button
          type="button"
          class="catalog-photo"
          data-catalog-edit="${key}"
          aria-label="${label}の画像と登録内容を編集"
        >${imageContent}</button>

        <h4>${key}</h4>

        <div class="catalog-counter">
          <button
            type="button"
            data-catalog-count="${key}"
            data-delta="-1"
            aria-label="${label}を1枚減らす"
            ${count === 0 ? 'disabled' : ''}
          >−</button>

          <strong>${count}枚</strong>

          <button
            type="button"
            data-catalog-count="${key}"
            data-delta="1"
            aria-label="${label}を1枚増やす"
            ${count >= 99999 ? 'disabled' : ''}
          >＋</button>
        </div>

        <div class="catalog-pose-actions">
          <button
            type="button"
            data-catalog-inventory="offer"
            data-pose="${key}"
          >提供</button>

          <button
            type="button"
            data-catalog-inventory="want"
            data-pose="${key}"
          >希望</button>

          <button
            type="button"
            data-catalog-favorite="${key}"
            aria-label="${label}のお気に入り"
            aria-pressed="${!!favorite?.favorite}"
          >${favorite?.favorite ? '★' : '☆'}</button>
        </div>

        <div class="catalog-pose-actions">
          <button
            type="button"
            data-catalog-edit="${key}"
          >編集・画像</button>

          ${
            items.length
              ? `<button type="button" data-catalog-records="${key}">登録内容</button>`
              : ''
          }
        </div>

        <div class="catalog-pose-actions">
          <button
            type="button"
            data-catalog-rename="${key}"
          >種類名を変更</button>

          <button
            type="button"
            data-catalog-remove="${key}"
          >種類を外す</button>
        </div>

        ${
          items.length > 1
            ? `<small>${items.length}件の登録を合算</small>`
            : ''
        }
      </article>
    `;
  }).join('') || empty(
    '下の欄から種類を追加してください。登録済みの写真は「登録済み一覧」に残っています。'
  );

  $('#photoCustomPoseHint').textContent =
    '基本の4種類も名前を変更・追加・一覧から削除できます。外した種類は同じ名前で追加すると再表示できます。';

  container.querySelectorAll('[data-catalog-image]').forEach(
    async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.catalogImage);

        if (url && element.isConnected) {
          const image = new Image();
          image.src = url;
          image.alt = `${member} ${entry.title}の生写真`;
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

function changeCatalogCount(pose, delta, favorite = false) {
  const entry = currentPhotoSeries();
  if (!entry) return;

  const inventory = photoInventory();

  const records = seriesPhotoRecords(
    photoBrowserState.member,
    entry,
    inventory
  ).filter((item) => item.pose === pose);

  const total = records.reduce(
    (sum, item) => sum + photoCount(item),
    0
  );

  if (
    !favorite &&
    (
      total + delta < 0 ||
      (delta > 0 && total + delta > 99999)
    )
  ) {
    return;
  }

  const previous = db.photos.map((item) => ({ ...item }));

  let item = delta < 0
    ? records.find((item) => photoCount(item) > 0)
    : records[0];

  if (!item) {
    item = {
      ...photoDefaults(entry, pose, inventory),
      id: crypto.randomUUID(),
      count: 0,
      status: '未所持'
    };

    db.photos.push(item);
  }

  if (favorite) {
    item.favorite = !records.some((record) => record.favorite);
    item.favoriteAt = item.favorite ? Date.now() : undefined;

    for (const record of records) {
      if (record !== item) {
        record.favorite = false;
        delete record.favoriteAt;
      }
    }
  } else {
    item.count = photoCount(item) + delta;
    item.status = item.count ? '所持' : '未所持';
  }

  try {
    save();
    render();
  } catch {
    db.photos = previous;
    toast('保存できませんでした。空き容量を確認してください');
    return;
  }

  const attribute = favorite
    ? 'data-catalog-favorite'
    : 'data-catalog-count';

  [...$('#photoCatalogContent').querySelectorAll(`[${attribute}]`)]
    .find(
      (button) =>
        button.getAttribute(attribute) === pose &&
        (favorite || Number(button.dataset.delta) === delta)
    )
    ?.focus({ preventScroll: true });
}

function initPhotoBrowser() {
  $('#photoCatalogSearch').addEventListener('input', (event) => {
    photoBrowserState.query = event.target.value;
    renderPhotoBrowser();
  });

  $('#photoCatalogYear').onchange = (event) => {
    photoBrowserState.year = event.target.value;
    renderPhotoBrowser();
  };

  $('#photoCatalogMissing').onchange = (event) => {
    photoBrowserState.onlyMissing = event.target.checked;
    renderPhotoBrowser();
  };

  $('#photoBrowserBack').onclick = () => {
    if (photoBrowserState.seriesId) {
      photoBrowserState.seriesId = '';
    } else {
      photoBrowserState.member = '';
    }

    photoBrowserState.query = '';
    photoBrowserState.year = '';

    renderPhotoBrowser();
    $('#photoBrowserTitle').focus();
  };

  $('#photoCatalogAdd').onclick = () => {
    const entry = currentPhotoSeries();

    document.dispatchEvent(new CustomEvent('photoformrequest', {
      detail: {
        defaults: entry
          ? photoDefaults(
              entry,
              photoSeriesPoses(photoBrowserState.member, entry)[0] || 'その他'
            )
          : {
              member: photoBrowserState.member,
              inventory: photoInventory()
            }
      }
    }));
  };

  $('#photoCustomPoseForm').onsubmit = (event) => {
    event.preventDefault();

    const entry = currentPhotoSeries();
    const input = $('#photoCustomPose');
    const pose = input.value.trim();

    if (!entry || !pose) return;

    if (pose.length > 80) {
      toast('種類名は1〜80文字で入力してください');
      return;
    }

    if (photoSeriesPoses(photoBrowserState.member, entry).includes(pose)) {
      toast('その種類は登録済みです');
      return;
    }

    const hidden = (
      db.photoCatalogHiddenPoses?.[photoBrowserState.member]?.[entry.id] || []
    ).filter((value) => value !== pose);

    if (
      storePhotoPoses(
        [...photoSeriesPoses(photoBrowserState.member, entry), pose],
        null,
        hidden
      )
    ) {
      input.value = '';
      toast('種類を追加しました');
    }
  };

  $('#photoCatalogContent').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.hasAttribute('data-catalog-member')) {
      photoBrowserState.member = button.dataset.catalogMember;
      photoBrowserState.query = '';
      photoBrowserState.year = '';

      renderPhotoBrowser();
      $('#photoBrowserTitle').focus();
    } else if (button.hasAttribute('data-catalog-series')) {
      photoBrowserState.seriesId = button.dataset.catalogSeries;

      renderPhotoBrowser();
      $('#photoBrowserTitle').focus();
    } else if (button.hasAttribute('data-catalog-count')) {
      changeCatalogCount(
        button.dataset.catalogCount,
        Number(button.dataset.delta)
      );
    } else if (button.hasAttribute('data-catalog-favorite')) {
      changeCatalogCount(button.dataset.catalogFavorite, 0, true);
    } else if (button.hasAttribute('data-catalog-rename')) {
      editPhotoPose(button.dataset.catalogRename);
    } else if (button.hasAttribute('data-catalog-remove')) {
      removePhotoPose(button.dataset.catalogRemove);
    } else if (button.hasAttribute('data-catalog-edit')) {
      requestPhotoForm(
        currentPhotoSeries(),
        button.dataset.catalogEdit
      );
    } else if (button.hasAttribute('data-catalog-inventory')) {
      requestPhotoForm(
        currentPhotoSeries(),
        button.dataset.pose,
        button.dataset.catalogInventory
      );
    } else if (button.hasAttribute('data-catalog-records')) {
      const entry = currentPhotoSeries();

      $('#photoMember').value = photoBrowserState.member;
      $('#photoSeries').value = entry.title;
      $('[data-search="photos"]').value =
        button.dataset.catalogRecords;

      $('#savedPhotos').open = true;

      renderSavedPhotos();

      $('#savedPhotos').scrollIntoView({
        block: 'start',
        behavior: 'smooth'
      });
    }
  });
}
