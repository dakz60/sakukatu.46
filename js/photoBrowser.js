'use strict';

const photoBrowserState = {
  browseMode: 'member',
  generation: '',
  browseSeriesId: '',
  member: '',
  seriesId: '',
  groupId: '',
  query: '',
  year: '',
  status: ''
};

const photoExtraGroups = [
  { name: 'HMV', kana: 'えいちえむぶい hmv' },
  { name: 'その他', kana: 'そのた' }
];

const photoMemberGenerations = {
  '2': [
    '遠藤光莉',
    '大園玲',
    '大沼晶保',
    '幸阪茉里乃',
    '田村保乃',
    '藤吉夏鈴',
    '松田里奈',
    '森田ひかる',
    '守屋麗奈',
    '山﨑天'
  ],

  '3': [
    '石森璃花',
    '遠藤理子',
    '小田倉麗奈',
    '小島凪紗',
    '谷口愛季',
    '中嶋優月',
    '的野美青',
    '向井純葉',
    '村井優',
    '村山美羽',
    '山下瞳月'
  ],

  '4': [
    '浅井恋乃未',
    '稲熊ひな',
    '勝又春',
    '佐藤愛桜',
    '中川智尋',
    '松本和子',
    '目黒陽色',
    '山川宇衣',
    '山田桃実'
  ]
};

function matchesPhotoGeneration(name) {
  const generation = photoBrowserState.generation;

  if (!generation) return true;

  if (generation === 'extra') {
    return photoExtraGroups.some(
      (item) => item.name === name
    );
  }

  return (
    photoMemberGenerations[generation]?.includes(name) ||
    false
  );
}

function renderPhotoGenerationFilter() {
  let field = $('#photoGenerationField');

  if (!field) {
    field = document.createElement('label');

    field.id = 'photoGenerationField';
    field.htmlFor = 'photoGeneration';

    field.append(
      document.createTextNode('期生')
    );

    const select = document.createElement('select');

    select.id = 'photoGeneration';
    select.className = 'filter';

    for (const [value, label] of [
      ['', 'すべて'],
      ['2', '二期生'],
      ['3', '三期生'],
      ['4', '四期生'],
      ['extra', 'HMV・その他']
    ]) {
      const option = document.createElement('option');

      option.value = value;
      option.textContent = label;

      select.append(option);
    }

    field.append(select);

    $('#photoCatalogYearField').before(field);

    select.onchange = () => {
      photoBrowserState.generation = select.value;

      renderPhotoBrowser();
    };
  }

  field.hidden = !!photoBrowserState.member;
  field.style.display = field.hidden ? 'none' : '';

  $('#photoGeneration').value =
    photoBrowserState.generation;
}

const photoBrowserSearchOptions = [];
const standardPhotoPoses = ['スワリ', 'ヨリ', 'チュウ', 'ヒキ'];

const photoUsagiGroups = [
  {
    id: 'morita',
    title: '森田まろまろさん／まろまろさん',
    poses: [
      '森田まろまろさん ヨリ',
      '森田まろまろさん チュウ',
      '森田まろまろさん ヒキ',
      '森田まろまろさん 座り',
      'まろまろさん チュウ',
      'まろまろさん ヒキ'
    ]
  },
  {
    id: 'yamashita',
    title: '山下しらたまさん／しらたまさん',
    poses: [
      '山下しらたまさん ヨリ',
      '山下しらたまさん チュウ',
      '山下しらたまさん ヒキ',
      '山下しらたまさん 座り',
      'しらたまさん チュウ',
      'しらたまさん ヒキ'
    ]
  },
  {
    id: 'asai',
    title: '浅井ぴょんきちさん／ぴょんきちさん',
    poses: [
      '浅井ぴょんきちさん ヨリ',
      '浅井ぴょんきちさん チュウ',
      '浅井ぴょんきちさん ヒキ',
      '浅井ぴょんきちさん 座り',
      'ぴょんきちさん チュウ',
      'ぴょんきちさん ヒキ'
    ]
  },
  {
    id: 'group',
    title: '集合',
    poses: [
      '集合①',
      '集合②',
      '集合③',
      '集合④',
      '集合（着ぐるみ）①',
      '集合（着ぐるみ）②'
    ]
  }
];

let photoSeriesIconBusy = false;
let photoMemberIconBusy = false;

function photoMemberOptions() {
  return [...members, ...photoExtraGroups];
}

const photoInventory = () =>
  photoView === 'owned' ? 'collection' : photoView;

const photoInventoryLabel = (inventory) =>
  ({
    collection: '所持',
    offer: '提供',
    want: '希望'
  })[inventory] || '所持';

function photoMemberThumbnail(member) {
  const icon = db.photoMemberIcons?.[member];

  return `
    <span
      class="catalog-member-thumb"
      ${
        icon?.imageId
          ? `
            data-series-thumbnail="${escapeHtml(icon.imageId)}"
            data-series-crop="${escapeHtml(
              JSON.stringify(icon.crop || null)
            )}"
          `
          : ''
      }
      aria-hidden="true"
    >${escapeHtml(member.slice(0, 1))}</span>
  `;
}

function storeMemberIcon(member, icon) {
  const previous = db.photoMemberIcons;
  const icons = { ...previous };

  if (icon) {
    icons[member] = icon;
  } else {
    delete icons[member];
  }

  db.photoMemberIcons = icons;

  try {
    save();
  } catch (error) {
    db.photoMemberIcons = previous;
    throw error;
  }
}

function deleteUnusedMemberIcon(id) {
  if (!id?.startsWith('member-icon-')) return;

  const shared = Object.values(
    db.photoMemberIcons || {}
  ).some((icon) => icon?.imageId === id);

  if (shared) return;

  if (!imageInUse(id)) {
    deletePhoto(id).catch(() => {});
  }
}

function renderMemberIconEditor() {
  let controls = $('#photoMemberIconEditor');

  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'photoMemberIconEditor';
    controls.className =
      'catalog-icon-editor catalog-member-icon-editor';

    $('#photoCatalogSummary').before(controls);

    controls.addEventListener('click', (event) => {
      const button = event.target.closest(
        '[data-member-icon-action]'
      );

      if (!button || photoMemberIconBusy) return;

      const action = button.dataset.memberIconAction;

      if (action === 'choose') {
        $('#photoMemberIconFile').click();
      } else if (action === 'crop') {
        editMemberIcon();
      } else if (action === 'remove') {
        removeMemberIcon();
      }
    });

    controls.addEventListener('change', (event) => {
      if (event.target.id !== 'photoMemberIconFile') {
        return;
      }

      const file = event.target.files[0];

      event.target.value = '';

      if (file) {
        editMemberIcon(file);
      }
    });
  }

  const member = photoBrowserState.member;

  controls.hidden = !member;

  if (!member) return;

  const icon = db.photoMemberIcons?.[member];

  controls.innerHTML = `
    ${photoMemberThumbnail(member)}

    <span class="catalog-icon-caption">
      ${escapeHtml(member)}のアイコン
    </span>

    <input
      type="file"
      id="photoMemberIconFile"
      accept="image/*"
      aria-label="メンバーのアイコン画像"
      hidden
    >

    <button
      type="button"
      class="secondary"
      data-member-icon-action="choose"
    >${icon?.imageId ? '画像を変更' : '画像を選ぶ'}</button>

    <button
      type="button"
      class="secondary"
      data-member-icon-action="crop"
      ${icon?.imageId ? '' : 'disabled'}
    >切り取り</button>

    <button
      type="button"
      class="subtle"
      data-member-icon-action="remove"
      ${icon?.imageId ? '' : 'disabled'}
    >解除</button>
  `;

  if (photoMemberIconBusy) {
    controls.querySelectorAll('button, input').forEach(
      (element) => {
        element.disabled = true;
      }
    );
  }

  loadSeriesThumbnails(controls);
}

async function editMemberIcon(file = null) {
  if (photoMemberIconBusy) return;

  const member = photoBrowserState.member;

  if (!member) return;

  if (
    file &&
    file.type &&
    !file.type.startsWith('image/')
  ) {
    toast('画像ファイルを選んでください');
    return;
  }

  const previous = db.photoMemberIcons?.[member];

  photoMemberIconBusy = true;

  let newId;
  let persisted = false;

  renderMemberIconEditor();

  try {
    const source =
      file ||
      (
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
      initialCrop: file ? null : previous?.crop
    });

    if (!crop) return;

    if (file) {
      newId = `member-icon-${crypto.randomUUID()}`;

      await savePhoto(newId, file, {
        compress: true
      });
    }

    storeMemberIcon(member, {
      imageId: newId || previous.imageId,
      crop
    });

    persisted = true;

    renderPhotoBrowser();

    if (newId) {
      deleteUnusedMemberIcon(previous?.imageId);
    }

    toast('メンバーのアイコンを保存しました');
  } catch (error) {
    if (newId && !persisted) {
      deleteUnusedMemberIcon(newId);
    }

    toast(
      error.message || 'アイコンを保存できませんでした'
    );
  } finally {
    photoMemberIconBusy = false;
    renderMemberIconEditor();
  }
}

function removeMemberIcon() {
  if (photoMemberIconBusy) return;

  const member = photoBrowserState.member;
  const previous = db.photoMemberIcons?.[member];

  if (!previous?.imageId) return;

  if (
    !confirm(`${member}のアイコンを解除しますか？`)
  ) {
    return;
  }

  try {
    storeMemberIcon(member, null);
  } catch (error) {
    toast(
      error.message || 'アイコンを解除できませんでした'
    );
    return;
  }

  renderPhotoBrowser();
  deleteUnusedMemberIcon(previous.imageId);

  toast('アイコンを解除しました');
}

function closePhotoPoseMenus(
  except = null,
  restoreFocus = false
) {
  document
    .querySelectorAll('.catalog-pose-menu[open]')
    .forEach((menu) => {
      if (menu === except) return;

      menu.open = false;

      if (restoreFocus) {
        menu.querySelector('summary')?.focus();
      }
    });
}

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

  for (
    const item of db.photos.filter(
      (item) => item.member === name
    )
  ) {
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

function seriesPhotoRecords(
  name,
  entry,
  inventory = photoInventory()
) {
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

function photoSeriesGroups(name, entry) {
  return (
    name === 'その他' &&
    entry?.title === '見つけて櫻坂うさぎ'
  )
    ? photoUsagiGroups
    : [];
}

function photoSeriesPoses(name, entry) {
  const configured =
    db.photoCatalogPoses?.[name]?.[entry.id];

  const saved =
    db.photoCatalogCustom?.[name]?.[entry.id] || [];

  const hidden =
    db.photoCatalogHiddenPoses?.[name]?.[entry.id] || [];

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

  const defaults =
    name === 'その他' &&
    entry.title === '見つけて櫻坂うさぎ'
      ? photoUsagiGroups.flatMap((group) => group.poses)
      : standardPhotoPoses;

  const base = Array.isArray(configured)
    ? configured
    : defaults;

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

function photoVisiblePoses(name, entry) {
  const poses = photoSeriesPoses(name, entry);

  const group = photoSeriesGroups(name, entry).find(
    (item) => item.id === photoBrowserState.groupId
  );

  return group
    ? poses.filter((pose) => group.poses.includes(pose))
    : poses;
}

function renderPhotoSeriesGroups(
  container,
  member,
  entry,
  groups,
  inventory
) {
  const poses = photoSeriesPoses(member, entry);
  const records = seriesPhotoRecords(
    member,
    entry,
    inventory
  );

  container.classList.remove('pose-grid');

  $('#photoCatalogSummary').textContent =
    `${groups.length}分類・全${poses.length}種類`;

  container.innerHTML = groups
    .map((group) => {
      const visible = poses.filter(
        (pose) => group.poses.includes(pose)
      );

      const owned = visible.filter(
        (pose) => photoPoseCount(records, pose) > 0
      ).length;

      return `
        <button
          type="button"
          class="catalog-series"
          data-catalog-group="${escapeHtml(group.id)}"
        >
          <span class="catalog-series-main">
            <strong>${escapeHtml(group.title)}</strong>

            <small>
              ${photoInventoryLabel(inventory)}
              ${owned} / ${visible.length}種類
            </small>
          </span>

          <span aria-hidden="true">›</span>
        </button>
      `;
    })
    .join('');
}

function sortPhotoRecords(items) {
  const names = [
    ...new Set([
      ...photoMemberOptions().map((member) => member.name),
      ...Object.keys(photoCatalogSource),
      ...db.photos.map((item) => item.member).filter(Boolean),
      ...items.map((item) => item.member).filter(Boolean)
    ])
  ];

  const memberOrder = new Map(
    names.map((name, index) => [name, index])
  );

  const seriesCache = new Map();
  const poseCache = new Map();

  function recordPosition(item) {
    if (!seriesCache.has(item.member)) {
      seriesCache.set(
        item.member,
        memberPhotoSeries(item.member)
      );
    }

    const entries = seriesCache.get(item.member);

    const seriesIndex = entries.findIndex((entry) =>
      item.catalogId
        ? entry.id === item.catalogId
        : entry.title === (item.series || 'シリーズ未設定')
    );

    const entry = entries[seriesIndex];
    let poses = standardPhotoPoses;

    if (entry) {
      const key = JSON.stringify([
        item.member,
        entry.id
      ]);

      if (!poseCache.has(key)) {
        poseCache.set(
          key,
          photoSeriesPoses(item.member, entry)
        );
      }

      poses = poseCache.get(key);
    }

    const poseIndex = poses.indexOf(item.pose);

    return {
      member: memberOrder.get(item.member) ?? names.length,
      series: seriesIndex < 0 ? entries.length : seriesIndex,
      pose: poseIndex < 0 ? poses.length : poseIndex
    };
  }

  return items
    .map((item, index) => ({
      item,
      index,
      position: recordPosition(item)
    }))
    .sort(
      (a, b) =>
        a.position.member - b.position.member ||
        a.position.series - b.position.series ||
        a.position.pose - b.position.pose ||
        a.index - b.index
    )
    .map((record) => record.item);
}

function storePhotoPoses(
  poses,
  rename = null,
  hidden = null
) {
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

  const value = prompt(
    '新しい種類名を入力してください',
    pose
  );

  if (value === null) return;

  const next = value.trim();
  const poses = photoSeriesPoses(
    photoBrowserState.member,
    entry
  );

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
      seriesPhotoRecords(
        photoBrowserState.member,
        entry,
        inventory
      )
  );

  if (records.some((item) => item.pose === next)) {
    toast(
      'その名前の登録が残っています。「種類を追加」から再表示できます'
    );
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
      ...(
        db.photoCatalogHiddenPoses
          ?.[photoBrowserState.member]
          ?.[entry.id] || []
      ),
      pose
    ])
  ];

  if (
    storePhotoPoses(
      photoSeriesPoses(
        photoBrowserState.member,
        entry
      ).filter((value) => value !== pose),
      null,
      hidden
    )
  ) {
    toast('種類を一覧から外しました');
  }
}

function photoSeriesThumbnail(member, entry) {
  const icon = db.photoSeriesIcons?.[member]?.[entry.id];

  return `
    <span
      class="catalog-series-thumb"
      ${
        icon?.imageId
          ? `
            data-series-thumbnail="${escapeHtml(icon.imageId)}"
            data-series-crop="${escapeHtml(
              JSON.stringify(icon.crop || null)
            )}"
          `
          : ''
      }
      aria-hidden="true"
    >▧</span>
  `;
}

function loadSeriesThumbnails(container) {
  container
    .querySelectorAll('[data-series-thumbnail]')
    .forEach(async (element) => {
      try {
        const url = await getPhotoURL(
          element.dataset.seriesThumbnail
        );

        if (!url || !element.isConnected) return;

        const image = new Image();
        image.alt = '';

        image.onload = () => {
          if (!element.isConnected) return;

          let crop = null;

          try {
            crop = JSON.parse(
              element.dataset.seriesCrop || 'null'
            );
          } catch {}

          applyAvatarCrop(image, crop);
        };

        image.src = url;
        element.replaceChildren(image);
      } catch {}
    });
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
  if (
    id?.startsWith('series-icon-') &&
    !imageInUse(id)
  ) {
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
      const button = event.target.closest(
        '[data-series-icon-action]'
      );

      if (!button || photoSeriesIconBusy) return;

      const action = button.dataset.seriesIconAction;

      if (action === 'choose') {
        $('#photoSeriesIconFile').click();
      } else if (action === 'crop') {
        editSeriesIcon();
      } else if (action === 'remove') {
        removeSeriesIcon();
      }
    });

    controls.addEventListener('change', (event) => {
      if (event.target.id !== 'photoSeriesIconFile') {
        return;
      }

      const file = event.target.files[0];

      event.target.value = '';

      if (file) {
        editSeriesIcon(file);
      }
    });
  }

  const entry = currentPhotoSeries();

  controls.hidden = !entry;

  if (!entry) return;

  const icon =
    db.photoSeriesIcons
      ?.[photoBrowserState.member]
      ?.[entry.id];

  controls.innerHTML = `
    ${photoSeriesThumbnail(photoBrowserState.member, entry)}

    <span class="catalog-icon-caption">
      シリーズのアイコン
    </span>

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
      ${icon?.imageId ? '' : 'disabled'}
    >切り取り</button>

    <button
      type="button"
      class="subtle"
      data-series-icon-action="remove"
      ${icon?.imageId ? '' : 'disabled'}
    >解除</button>
  `;

  if (photoSeriesIconBusy) {
    controls.querySelectorAll('input, button').forEach(
      (element) => {
        element.disabled = true;
      }
    );
  }

  loadSeriesThumbnails(controls);
}

async function editSeriesIcon(file = null) {
  if (photoSeriesIconBusy) return;

  const member = photoBrowserState.member;
  const entry = currentPhotoSeries();

  if (!entry) return;

  if (
    file &&
    file.type &&
    !file.type.startsWith('image/')
  ) {
    toast('画像ファイルを選んでください');
    return;
  }

  const previous =
    db.photoSeriesIcons?.[member]?.[entry.id];

  photoSeriesIconBusy = true;

  let newId;
  let persisted = false;

  renderSeriesIconEditor();

  try {
    const source =
      file ||
      (
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

    toast(
      'アイコンを保存できませんでした。画像と空き容量を確認してください'
    );
  } finally {
    photoSeriesIconBusy = false;
    renderSeriesIconEditor();
  }
}

function removeSeriesIcon() {
  if (photoSeriesIconBusy) return;

  const member = photoBrowserState.member;
  const entry = currentPhotoSeries();

  const previous =
    entry && db.photoSeriesIcons?.[member]?.[entry.id];

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

  toast('シリーズのアイコンを解除しました');
}

function photoPoseCount(records, pose) {
  return records
    .filter((item) => item.pose === pose)
    .reduce(
      (total, item) => total + photoCount(item),
      0
    );
}

function photoSeriesProgress(member, entry) {
  const poses = photoSeriesPoses(member, entry);

  const records = seriesPhotoRecords(
    member,
    entry,
    'collection'
  );

  const owned = poses.filter(
    (pose) => photoPoseCount(records, pose) > 0
  ).length;

  const total = poses.length;

  return {
    owned,
    total,
    missing: owned === 0,
    hasOwned: owned > 0,
    semi: owned > 0 && owned === total - 1,
    complete: total > 0 && owned === total
  };
}

function currentPhotoSeries() {
  return memberPhotoSeries(
    photoBrowserState.member
  ).find(
    (entry) =>
      entry.id === photoBrowserState.seriesId
  );
}

function photoDefaults(
  entry,
  pose,
  inventory = photoInventory()
) {
  return {
    member: photoBrowserState.member,
    series: entry.title,
    pose,
    inventory,
    count: 1,
    category: /封入$/.test(entry.title)
      ? 'CD封入'
      : '公式ランダム',
    catalogId: entry.id
  };
}

function requestPhotoForm(
  entry,
  pose,
  inventory = photoInventory()
) {
  if (!entry) return;

  const records = seriesPhotoRecords(
    photoBrowserState.member,
    entry,
    inventory
  ).filter((item) => item.pose === pose);

  const item =
    records.find((item) => photoCount(item) > 0) ||
    records[0];

  document.dispatchEvent(
    new CustomEvent('photoformrequest', {
      detail: {
        item,
        defaults: photoDefaults(
          entry,
          pose,
          inventory
        )
      }
    })
  );
}

function openPhotoCatalogRecord(item) {
  photoBrowserState.member = item.member;
  photoBrowserState.groupId = '';

  const entry = memberPhotoSeries(
    item.member
  ).find((entry) =>
    item.catalogId
      ? entry.id === item.catalogId
      : !entry.duplicate && entry.title === item.series
  );

  photoBrowserState.seriesId = entry?.id || '';

  if (photoBrowserState.browseMode === 'series') {
    photoBrowserState.browseSeriesId = entry?.id || '';
  }

  photoBrowserState.groupId =
    photoSeriesGroups(item.member, entry).find(
      (group) => group.poses.includes(item.pose)
    )?.id || '';

  photoBrowserState.query = '';
  photoBrowserState.year = '';
  photoBrowserState.status = '';

  renderPhotos();

  $('#savedPhotos').open = true;
}

function renderPhotoCollectionSummary(
  member,
  entries,
  visibleCount,
  inventory
) {
  const summary = $('#photoCatalogSummary');

  if (inventory !== 'collection') {
    summary.textContent =
      `${visibleCount}シリーズを表示`;
    return;
  }

  const progressList = entries.map(
    (entry) => photoSeriesProgress(member, entry)
  );

  const owned = progressList.reduce(
    (sum, progress) => sum + progress.owned,
    0
  );

  const total = progressList.reduce(
    (sum, progress) => sum + progress.total,
    0
  );

  const rate = total ? (owned / total) * 100 : 0;

  const complete = progressList.filter(
    (progress) => progress.complete
  ).length;

  const semi = progressList.filter(
    (progress) => progress.semi
  ).length;

  summary.innerHTML = `
    <span class="photo-progress-heading">
      <span>
        収集率
        ${owned.toLocaleString()} /
        ${total.toLocaleString()}種類
      </span>

      <strong>${rate.toFixed(1)}％</strong>
    </span>

    <progress
      class="photo-progress-bar"
      max="${total || 1}"
      value="${owned}"
      aria-label="メンバー全体の収集率"
    ></progress>

    <span class="photo-progress-counts">
      <span>コンプ ${complete}シリーズ</span>
      <span>セミコンプ ${semi}シリーズ</span>
    </span>

    <span class="photo-progress-results">
      ${visibleCount}シリーズを表示
    </span>
  `;
}

function photoBrowseEntries() {
  const names = [
    ...new Set([
      ...photoMemberOptions().map((item) => item.name),
      ...Object.keys(photoCatalogSource),
      ...db.photos.map((item) => item.member).filter(Boolean)
    ])
  ];

  const entries = new Map();

  for (const name of names) {
    for (const series of memberPhotoSeries(name)) {
      if (!entries.has(series.id)) {
        entries.set(series.id, {
          ...series,
          members: [],
          duplicate: false
        });
      }

      const entry = entries.get(series.id);

      entry.duplicate ||= series.duplicate;
      entry.members.push(name);
    }
  }

  return [...entries.values()];
}

function renderPhotoBrowseMode() {
  let controls = $('#photoBrowseMode');

  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'photoBrowseMode';
    controls.className = 'collection-tabs';

    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', '生写真の探し方');

    controls.innerHTML = `
      <button
        type="button"
        class="secondary"
        data-photo-browse="member"
      >メンバーから</button>

      <button
        type="button"
        class="secondary"
        data-photo-browse="series"
      >シリーズ・衣装から</button>
    `;

    $('#photoBrowserBack').before(controls);

    controls.addEventListener('click', (event) => {
      const button = event.target.closest(
        '[data-photo-browse]'
      );

      if (!button || !controls.contains(button)) return;

      Object.assign(photoBrowserState, {
        browseMode: button.dataset.photoBrowse,
        browseSeriesId: '',
        member: '',
        seriesId: '',
        groupId: '',
        query: '',
        year: '',
        status: ''
      });

      renderPhotoBrowser();

      $('#photoBrowserTitle').focus();
    });
  }

  controls
    .querySelectorAll('[data-photo-browse]')
    .forEach((button) => {
      const active =
        button.dataset.photoBrowse ===
        photoBrowserState.browseMode;

      button.setAttribute(
        'aria-pressed',
        String(active)
      );

      button.classList.toggle('active', active);
    });
}

function renderSeriesFirstBrowser() {
  const state = photoBrowserState;
  const inventory = photoInventory();
  const entries = photoBrowseEntries();

  const selected = entries.find(
    (entry) => entry.id === state.browseSeriesId
  );

  if (!selected) {
    state.browseSeriesId = '';
  }

  const content = $('#photoCatalogContent');

  content.classList.remove('pose-grid');

  renderSeriesIconEditor();

  $('#photoBrowserBack').hidden = !selected;
  $('#photoBrowserBack').textContent =
    '‹ シリーズ・衣装へ';

  $('#photoBrowserTitle').textContent = selected
    ? `${selected.title}：メンバーを選ぶ`
    : 'シリーズ・衣装を選ぶ';

  $('#photoBrowserCrumb').textContent =
    `シリーズ・衣装から / ${photoInventoryLabel(inventory)}`;

  $('#photoCustomPoseForm').hidden = true;
  $('#photoCatalogAdd').hidden = true;
  $('#photoCatalogMissingLabel').hidden = true;
  $('#photoCatalogYearField').hidden = !!selected;

  const search = $('#photoCatalogSearch');
  const picker = search.closest('.member-picker');

  search.hidden = false;

  if (picker) {
    picker.hidden = false;
  }

  search.placeholder = selected
    ? 'メンバーを検索'
    : 'シリーズ・衣装を検索';

  search.setAttribute(
    'aria-label',
    search.placeholder
  );

  search.value = state.query;

  const years = [
    ...new Set(
      entries.flatMap(
        (entry) => entry.title.match(/20\d{2}/g) || []
      )
    )
  ].sort().reverse();

  $('#photoCatalogYear').replaceChildren(
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

  $('#photoCatalogYear').value = state.year;

  const memberOptions = photoMemberOptions();

  const options = selected
    ? selected.members.map(
        (name) =>
          memberOptions.find(
            (item) => item.name === name
          ) || { name, kana: '' }
      )
    : [
        ...new Set(
          entries.map((entry) => entry.title)
        )
      ].map((name) => ({
        name,
        kana: ''
      }));

  photoBrowserSearchOptions.splice(
    0,
    photoBrowserSearchOptions.length,
    ...options
  );

  if (selected) {
    const visible = options.filter(
      (item) =>
        normalize(`${item.name} ${item.kana}`).includes(
          normalize(state.query)
        )
    );

    $('#photoCatalogSummary').textContent =
      `${visible.length}人・分類を表示`;

    content.innerHTML =
      visible
        .map((item) => {
          const series = memberPhotoSeries(
            item.name
          ).find(
            (entry) => entry.id === selected.id
          );

          const poses = photoSeriesPoses(
            item.name,
            series
          );

          const records = seriesPhotoRecords(
            item.name,
            series,
            inventory
          );

          const owned = poses.filter(
            (pose) => photoPoseCount(records, pose) > 0
          ).length;

          return `
            <button
              type="button"
              class="catalog-member"
              data-catalog-member="${escapeHtml(item.name)}"
            >
              ${photoMemberThumbnail(item.name)}

              <span>
                <strong>${escapeHtml(item.name)}</strong>

                <small>
                  ${photoInventoryLabel(inventory)}
                  ${owned} / ${poses.length}種類
                </small>
              </span>

              <span aria-hidden="true">›</span>
            </button>
          `;
        })
        .join('') ||
      empty('条件に合うメンバー・分類はありません');

    loadSeriesThumbnails(content);

    return;
  }

  const visible = entries.filter((entry) => {
    const itemYears =
      entry.title.match(/20\d{2}/g) || [];

    return (
      normalize(entry.title).includes(
        normalize(state.query)
      ) &&
      (
        !state.year ||
        (
          state.year === 'unknown'
            ? !itemYears.length
            : itemYears.includes(state.year)
        )
      )
    );
  });

  $('#photoCatalogSummary').textContent =
    `${visible.length}シリーズを表示`;

  content.innerHTML =
    visible
      .map(
        (entry) => `
          <button
            type="button"
            class="catalog-series"
            data-browse-series="${escapeHtml(entry.id)}"
          >
            <span class="catalog-series-main">
              <strong>${escapeHtml(entry.title)}</strong>

              ${
                entry.duplicate
                  ? `<small>同名項目 ${entry.occurrence}</small>`
                  : ''
              }

              <small>${entry.members.length}人・分類</small>
            </span>

            <span aria-hidden="true">›</span>
          </button>
        `
      )
      .join('') ||
    empty('条件に合うシリーズ・衣装はありません');
}

function renderPhotoBrowser() {
  renderMemberIconEditor();
  renderPhotoBrowseMode();

  if (
    photoBrowserState.browseMode === 'series' &&
    !photoBrowserState.member
  ) {
    renderSeriesFirstBrowser();
    return;
  }

  const state = photoBrowserState;
  const inventory = photoInventory();
  const member = state.member;
  const entry = member ? currentPhotoSeries() : null;

  if (state.seriesId && !entry) {
    state.seriesId = '';
  }

  const groups = photoSeriesGroups(member, entry);

  const group = groups.find(
    (item) => item.id === state.groupId
  );

  if (!group) {
    state.groupId = '';
  }

  renderSeriesIconEditor();

  $('#photoBrowserBack').hidden = !member;

  $('#photoBrowserBack').textContent = group
    ? '‹ 4分類へ戻る'
    : entry
      ? (
          state.browseMode === 'series'
            ? '‹ メンバーへ'
            : '‹ 衣装・シリーズへ'
        )
      : '‹ メンバーへ';

  $('#photoBrowserTitle').textContent = group
    ? group.title
    : entry
      ? entry.title
      : member || 'メンバーを選ぶ';

  $('#photoBrowserCrumb').textContent = group
    ? `${member} / ${entry.title} / ${photoInventoryLabel(inventory)}`
    : entry
      ? `${member} / ${photoInventoryLabel(inventory)}`
      : '生写真コレクション';

  const search = $('#photoCatalogSearch');
  const picker = search.closest('.member-picker');

  search.hidden = !!entry;

  if (picker) {
    picker.hidden = !!entry;
  }

  search.placeholder = member
    ? '衣装・シリーズを検索'
    : 'メンバー・分類を検索';

  search.setAttribute(
    'aria-label',
    search.placeholder
  );

  if (search.value !== state.query) {
    search.value = state.query;
  }

  const searchOptions = member
    ? memberPhotoSeries(member).map((series) => ({
        name: series.title,
        kana: ''
      }))
    : photoMemberOptions();

  photoBrowserSearchOptions.splice(
    0,
    photoBrowserSearchOptions.length,
    ...searchOptions
  );

  const years =
    member && !entry
      ? [
          ...new Set(
            memberPhotoSeries(member).flatMap(
              (series) =>
                series.title.match(/20\d{2}/g) || []
            )
          )
        ].sort().reverse()
      : [];

  $('#photoCatalogYearField').hidden =
    !member || !!entry;

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

  const statusSelect = $('#photoCatalogStatus');

  if (statusSelect) {
    statusSelect.value = state.status;
  }

  $('#photoCustomPoseForm').hidden =
    !entry || groups.length > 0;

  $('#photoCatalogAdd').hidden =
    !member || (groups.length > 0 && !group);

  $('#photoCatalogAdd').textContent = group
    ? '＋ この分類の写真を登録'
    : entry
      ? '＋ このシリーズの写真を登録'
      : '＋ 一覧にない写真を登録';

  const container = $('#photoCatalogContent');

  container.classList.toggle('pose-grid', !!entry);

  if (!member) {
    const names = [
      ...new Set([
        ...photoMemberOptions().map((item) => item.name),
        ...Object.keys(photoCatalogSource),
        ...db.photos.map((item) => item.member).filter(Boolean)
      ])
    ];

    const memberOptions = photoMemberOptions();

    const visible = names.filter((name) => {
      const kana =
        memberOptions.find(
          (item) => item.name === name
        )?.kana || '';

      return normalize(`${name} ${kana}`).includes(
        normalize(state.query)
      );
    });

    const extraNames = new Set(
      photoExtraGroups.map((item) => item.name)
    );

    const memberCount = visible.filter(
      (name) => !extraNames.has(name)
    ).length;

    const groupCount = visible.filter(
      (name) => extraNames.has(name)
    ).length;

    $('#photoCatalogSummary').textContent =
      `${memberCount}人` +
      (groupCount ? `・${groupCount}分類` : '');

    container.innerHTML =
      visible
        .map((name) => {
          const count = db.photos
            .filter(
              (item) =>
                item.member === name &&
                item.inventory === inventory
            )
            .reduce(
              (sum, item) => sum + photoCount(item),
              0
            );

          return `
            <button
              type="button"
              class="catalog-member"
              data-catalog-member="${escapeHtml(name)}"
            >
              ${photoMemberThumbnail(name)}

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
        })
        .join('') ||
      empty('メンバー・分類が見つかりません');

    loadSeriesThumbnails(container);

    return;
  }

  if (!entry) {
    const all = memberPhotoSeries(member);

    const visible = all.filter((item) => {
      const itemYears =
        item.title.match(/20\d{2}/g) || [];

      const matchesQuery = normalize(
        item.title
      ).includes(normalize(state.query));

      const matchesYear =
        !state.year ||
        (
          state.year === 'unknown'
            ? !itemYears.length
            : itemYears.includes(state.year)
        );

      const matchesStatus =
        !state.status ||
        inventory !== 'collection' ||
        photoSeriesProgress(
          member,
          item
        )[state.status] === true;

      return (
        matchesQuery &&
        matchesYear &&
        matchesStatus
      );
    });

    renderPhotoCollectionSummary(
      member,
      all,
      visible.length,
      inventory
    );

    container.innerHTML =
      visible
        .map((item) => {
          const records = seriesPhotoRecords(
            member,
            item
          );

          const poses = photoSeriesPoses(
            member,
            item
          );

          const complete = poses.filter(
            (pose) => photoPoseCount(records, pose) > 0
          ).length;

          const rate = poses.length
            ? (complete / poses.length) * 100
            : 0;

          const missingPoses = poses.filter(
            (pose) => photoPoseCount(records, pose) === 0
          );

          const progressHint = !poses.length
            ? '種類を登録してください'
            : complete === poses.length
              ? 'コンプ'
              : complete === 0
                ? '未所持'
                : missingPoses.length === 1
                  ? `あと${missingPoses[0]}でコンプ`
                  : `未所持：${missingPoses.join('・')}`;

          const chips =
            poses
              .map(
                (pose) => `
                  <span
                    class="pose-chip ${
                      photoPoseCount(records, pose) > 0
                        ? 'is-owned'
                        : ''
                    }"
                  >${escapeHtml(pose)}</span>
                `
              )
              .join('') ||
            '<span class="pose-chip">種類を登録</span>';

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
                    ? `
                      <small>
                        同名項目 ${item.occurrence}（原文の順番）
                      </small>
                    `
                    : ''
                }

                <small>
                  ${photoInventoryLabel(inventory)}
                  ${complete} / ${poses.length}種類

                  ${
                    inventory === 'collection'
                      ? `・${Number(rate.toFixed(1))}％`
                      : ''
                  }
                </small>

                ${
                  inventory === 'collection'
                    ? `
                      <small class="photo-series-progress-hint">
                        ${escapeHtml(progressHint)}
                      </small>
                    `
                    : ''
                }

                <span class="pose-chips">${chips}</span>
              </span>

              <span aria-hidden="true">›</span>
            </button>
          `;
        })
        .join('') ||
      empty('条件に合うシリーズはありません');

    loadSeriesThumbnails(container);

    return;
  }

  if (groups.length && !group) {
    renderPhotoSeriesGroups(
      container,
      member,
      entry,
      groups,
      inventory
    );

    return;
  }

  const records = seriesPhotoRecords(member, entry);
  const poses = photoVisiblePoses(member, entry);

  const complete = poses.filter(
    (pose) => photoPoseCount(records, pose) > 0
  ).length;

  $('#photoCatalogSummary').textContent =
    `${photoInventoryLabel(inventory)} ${complete} / ${poses.length}種類` +
    (
      entry.duplicate
        ? ' · 同名の別項目とは分けて管理'
        : ''
    );

  container.innerHTML =
    poses
      .map((pose) => {
        const items = records.filter(
          (item) => item.pose === pose
        );

        const count = photoPoseCount(records, pose);

        const item =
          items.find((item) => item.imageId) ||
          items[0];

        const favorite =
          items.find((item) => item.favorite) ||
          items[0];

        const key = escapeHtml(pose);

        const label = escapeHtml(
          `${member} ${entry.title} ${pose}`
        );

        const imageContent = item
          ? `
            <span
              data-catalog-image="${escapeHtml(
                item.imageId || item.id
              )}"
            >
              ${count ? '写真を登録' : '未登録'}
            </span>
          `
          : `
            <span>
              ${inventory === 'collection' ? '未所持' : '未登録'}
            </span>
          `;

        return `
          <article
            class="catalog-pose"
            data-catalog-pose="${key}"
          >
            <button
              type="button"
              class="catalog-photo"
              data-catalog-edit="${key}"
              aria-label="${label}の画像と登録内容を編集"
            >${imageContent}</button>

            <div class="catalog-pose-heading">
              <h4>${key}</h4>

              <button
                type="button"
                class="catalog-favorite"
                data-catalog-favorite="${key}"
                aria-label="${label}のお気に入り"
                aria-pressed="${!!favorite?.favorite}"
              >${favorite?.favorite ? '★' : '☆'}</button>

              <details class="catalog-pose-menu">
                <summary
                  aria-label="${label}の管理操作"
                >︙</summary>

                <div class="catalog-pose-menu-panel">
                  <button
                    type="button"
                    data-catalog-inventory="offer"
                    data-pose="${key}"
                  >提供に登録</button>

                  <button
                    type="button"
                    data-catalog-inventory="want"
                    data-pose="${key}"
                  >希望に登録</button>

                  <hr>

                  <button
                    type="button"
                    data-catalog-edit="${key}"
                  >編集・画像</button>

                  ${
                    items.length
                      ? `
                        <button
                          type="button"
                          data-catalog-records="${key}"
                        >登録内容</button>
                      `
                      : ''
                  }

                  <button
                    type="button"
                    data-catalog-rename="${key}"
                  >種類名を変更</button>

                  <hr>

                  <button
                    type="button"
                    class="catalog-menu-remove"
                    data-catalog-remove="${key}"
                  >種類を外す</button>
                </div>
              </details>
            </div>

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

            ${
              items.length > 1
                ? `<small>${items.length}件の登録を合算</small>`
                : ''
            }
          </article>
        `;
      })
      .join('') ||
    empty(
      '下の欄から種類を追加してください。登録済みの写真は「登録済み一覧」に残っています。'
    );

  $('#photoCustomPoseHint').textContent =
    '基本の4種類も名前を変更・追加・一覧から削除できます。外した種類は同じ名前で追加すると再表示できます。';

  container
    .querySelectorAll('[data-catalog-image]')
    .forEach(async (element) => {
      try {
        const url = await getPhotoURL(
          element.dataset.catalogImage
        );

        if (url && element.isConnected) {
          const image = new Image();

          image.src = url;
          image.alt =
            `${member} ${entry.title}の生写真`;

          element.replaceChildren(image);
        }
      } catch {
        if (element.isConnected) {
          element.textContent =
            '画像を読み込めませんでした';
        }
      }
    });
}

function changeCatalogCount(
  pose,
  delta,
  favorite = false
) {
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

  const previous = db.photos.map(
    (item) => ({ ...item })
  );

  let item =
    delta < 0
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
    item.favorite = !records.some(
      (record) => record.favorite
    );

    item.favoriteAt = item.favorite
      ? Date.now()
      : undefined;

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
  } catch {
    db.photos = previous;

    toast(
      '保存できませんでした。空き容量を確認してください'
    );

    return;
  }

  render();

  const attribute = favorite
    ? 'data-catalog-favorite'
    : 'data-catalog-count';

  [
    ...$('#photoCatalogContent').querySelectorAll(
      `[${attribute}]`
    )
  ]
    .find(
      (button) =>
        button.getAttribute(attribute) === pose &&
        (
          favorite ||
          Number(button.dataset.delta) === delta
        )
    )
    ?.focus({ preventScroll: true });
}

function initPhotoBrowser() {
  const content = $('#photoCatalogContent');

  if (content.dataset.browserReady) return;

  content.dataset.browserReady = 'true';

  content.addEventListener(
    'toggle',
    (event) => {
      const menu = event.target;

      if (
        !menu.matches?.('.catalog-pose-menu') ||
        !menu.open
      ) {
        return;
      }

      closePhotoPoseMenus(menu);

      requestAnimationFrame(() => {
        if (!menu.open || !menu.isConnected) return;

        const panel = menu.querySelector(
          '.catalog-pose-menu-panel'
        );

        menu.classList.remove('opens-up');

        panel.style.left = '';
        panel.style.right = '';

        const bounds = panel.getBoundingClientRect();

        if (bounds.left < 8) {
          panel.style.left = '0';
          panel.style.right = 'auto';
        }

        const trigger = menu.getBoundingClientRect();

        if (
          bounds.bottom > innerHeight - 8 &&
          trigger.top > bounds.height + 8
        ) {
          menu.classList.add('opens-up');
        }
      });
    },
    true
  );

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.catalog-pose-menu')) {
      closePhotoPoseMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      document.querySelector('.catalog-pose-menu[open]')
    ) {
      event.preventDefault();
      closePhotoPoseMenus(null, true);
    }
  });

  const statusLabel = $('#photoCatalogMissingLabel');
  const statusSelect = document.createElement('select');

  statusSelect.id = 'photoCatalogStatus';
  statusSelect.className = 'filter';

  statusSelect.setAttribute(
    'aria-label',
    'シリーズの所持状況'
  );

  for (const [value, label] of [
    ['', 'すべて'],
    ['missing', '未所持'],
    ['hasOwned', '所持'],
    ['semi', 'セミコンプ'],
    ['complete', 'コンプ']
  ]) {
    const option = document.createElement('option');

    option.value = value;
    option.textContent = label;

    statusSelect.append(option);
  }

  statusLabel.replaceChildren(
    document.createTextNode('所持状況'),
    statusSelect
  );

  const browser = content.closest(
    '.photo-catalog-browser'
  );

  const saved = $('#savedPhotos');

  saved.querySelector('summary').textContent =
    '登録済み写真の検索・個別の編集と削除';

  browser.before(saved);

  const search = $('#photoCatalogSearch');

  photoBrowserSearchOptions.splice(
    0,
    photoBrowserSearchOptions.length,
    ...photoMemberOptions()
  );

  attachMemberAutocomplete(
    search,
    photoBrowserSearchOptions
  );

  const picker = search.closest('.member-picker');

  picker.style.flex = '1 1 220px';
  picker.style.maxWidth = '420px';
  picker.style.minWidth = '0';

  const updateSearch = () => {
    if (
      photoBrowserState.query === search.value
    ) {
      return;
    }

    photoBrowserState.query = search.value;

    renderPhotoBrowser();
  };

  search.addEventListener('input', updateSearch);
  search.addEventListener('change', updateSearch);

  const savedSearch = $('[data-search="photos"]');

  attachMemberAutocomplete(
    savedSearch,
    photoMemberOptions()
  );

  savedSearch.placeholder =
    'メンバー・シリーズ・メモを検索';

  savedSearch.closest('.member-picker').style.minWidth =
    '0';

  let savedQuery = savedSearch.value;

  savedSearch.addEventListener('input', () => {
    savedQuery = savedSearch.value;
  });

  savedSearch.addEventListener('change', () => {
    if (savedQuery === savedSearch.value) return;

    savedQuery = savedSearch.value;

    renderSavedPhotos();
  });

  $('#photoCatalogYear').onchange = (event) => {
    photoBrowserState.year = event.target.value;

    renderPhotoBrowser();
  };

  statusSelect.onchange = (event) => {
    photoBrowserState.status = event.target.value;

    renderPhotoBrowser();
  };

  $('#photoBrowserBack').onclick = () => {
    if (photoBrowserState.groupId) {
      photoBrowserState.groupId = '';
    } else if (
      photoBrowserState.browseMode === 'series'
    ) {
      if (photoBrowserState.member) {
        photoBrowserState.member = '';
        photoBrowserState.seriesId = '';
      } else {
        photoBrowserState.browseSeriesId = '';
      }
    } else if (photoBrowserState.seriesId) {
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

    document.dispatchEvent(
      new CustomEvent('photoformrequest', {
        detail: {
          defaults: entry
            ? photoDefaults(
                entry,
                photoVisiblePoses(
                  photoBrowserState.member,
                  entry
                )[0] || 'その他'
              )
            : {
                member: photoBrowserState.member,
                inventory: photoInventory()
              }
        }
      })
    );
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

    const poses = photoSeriesPoses(
      photoBrowserState.member,
      entry
    );

    if (poses.includes(pose)) {
      toast('その種類は登録済みです');
      return;
    }

    const hidden = (
      db.photoCatalogHiddenPoses
        ?.[photoBrowserState.member]
        ?.[entry.id] || []
    ).filter((value) => value !== pose);

    if (
      storePhotoPoses(
        [...poses, pose],
        null,
        hidden
      )
    ) {
      input.value = '';

      toast('種類を追加しました');
    }
  };

  content.addEventListener('click', (event) => {
    const button = event.target.closest('button');

    if (!button || !content.contains(button)) return;

    const menu = button.closest('.catalog-pose-menu');

    if (menu) {
      menu.open = false;
    }

    if (button.hasAttribute('data-browse-series')) {
      photoBrowserState.browseSeriesId =
        button.dataset.browseSeries;

      photoBrowserState.member = '';
      photoBrowserState.seriesId = '';
      photoBrowserState.groupId = '';
      photoBrowserState.query = '';
      photoBrowserState.year = '';

      renderPhotoBrowser();

      $('#photoBrowserTitle').focus();
    } else if (
      button.hasAttribute('data-catalog-group')
    ) {
      const groups = photoSeriesGroups(
        photoBrowserState.member,
        currentPhotoSeries()
      );

      if (
        !groups.some(
          (group) =>
            group.id === button.dataset.catalogGroup
        )
      ) {
        return;
      }

      photoBrowserState.groupId =
        button.dataset.catalogGroup;

      renderPhotoBrowser();

      $('#photoBrowserTitle').focus();
    } else if (
      button.hasAttribute('data-catalog-member')
    ) {
      photoBrowserState.groupId = '';
      photoBrowserState.member =
        button.dataset.catalogMember;

      photoBrowserState.seriesId =
        photoBrowserState.browseMode === 'series'
          ? photoBrowserState.browseSeriesId
          : '';

      photoBrowserState.query = '';
      photoBrowserState.year = '';

      renderPhotoBrowser();

      $('#photoBrowserTitle').focus();
    } else if (
      button.hasAttribute('data-catalog-series')
    ) {
      photoBrowserState.groupId = '';
      photoBrowserState.seriesId =
        button.dataset.catalogSeries;

      renderPhotoBrowser();

      $('#photoBrowserTitle').focus();
    } else if (
      button.hasAttribute('data-catalog-count')
    ) {
      changeCatalogCount(
        button.dataset.catalogCount,
        Number(button.dataset.delta)
      );
    } else if (
      button.hasAttribute('data-catalog-favorite')
    ) {
      changeCatalogCount(
        button.dataset.catalogFavorite,
        0,
        true
      );
    } else if (
      button.hasAttribute('data-catalog-rename')
    ) {
      editPhotoPose(button.dataset.catalogRename);
    } else if (
      button.hasAttribute('data-catalog-remove')
    ) {
      removePhotoPose(button.dataset.catalogRemove);
    } else if (
      button.hasAttribute('data-catalog-edit')
    ) {
      requestPhotoForm(
        currentPhotoSeries(),
        button.dataset.catalogEdit
      );
    } else if (
      button.hasAttribute('data-catalog-inventory')
    ) {
      requestPhotoForm(
        currentPhotoSeries(),
        button.dataset.pose,
        button.dataset.catalogInventory
      );
    } else if (
      button.hasAttribute('data-catalog-records')
    ) {
      const entry = currentPhotoSeries();

      if (!entry) return;

      renderSavedPhotos();

      $('#photoMember').value =
        photoBrowserState.member;

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
