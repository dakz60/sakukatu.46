'use strict';

const goodsDefaultTypes = [
  'ペンライト',
  'ミニペンラ',
  'タオル',
  'ラババン',
  'アクスタ',
  '缶バ',
  'アクキー',
  'チャーム',
  'ワッペン',
  'ウエハース',
  'クリアカード',
  'ポストカード',
  'グリーティングカード',
  'サクコイ',
  'ユニエア',
  'サクコレ',
  'イオン',
  'HMV',
  'Tower Lecords',
  'Line music'
  '直筆',
  '雑誌',
  'ステッカー',
  'クリアファイル',
  'フォトアルバム',
  'カフェ',
  'マグカップ'
];

const goodsBrowserState = {
  member: '',
  type: '',
  series: '',
  inventory: 'collection',
  query: '',
  favoritesOnly: false
};

let goodsBrowserBusy = false;
let goodsEditingId = null;

const goodsInventoryLabel = (value) =>
  ({ collection: '所持', offer: '提供', want: '希望' })[value];

const goodsMember = (item) => item.member || '共通・集合';
const goodsType = (item) => item.type || 'その他';
const goodsSeries = (item) => item.series || 'シリーズ未設定';
const goodsVariant = (item) => item.variant || item.title || '通常';

const goodsInventory = (item) =>
  item.inventory || (item.status === '購入予定' ? 'want' : 'collection');

function goodsCount(item) {
  const count = Number(item.count);

  if (
    item.count != null &&
    item.count !== '' &&
    Number.isSafeInteger(count) &&
    count >= 0
  ) {
    return count;
  }

  return item.status === '未所持' ? 0 : 1;
}

function goodsCatalogId(member, type, series) {
  return JSON.stringify([member, type, series]);
}

function goodsCatalogEntries() {
  const entries = new Map(
    (db.goodsCatalog || []).map((entry) => [
      entry.id,
      { ...entry, variants: [...entry.variants] }
    ])
  );

  for (const item of db.goods) {
    const member = goodsMember(item);
    const type = goodsType(item);
    const series = goodsSeries(item);
    const id = goodsCatalogId(member, type, series);

    if (!entries.has(id)) {
      entries.set(id, {
        id,
        member,
        type,
        series,
        variants: [],
        unit: /カード/.test(type) ? '枚' : '個'
      });
    }

    const entry = entries.get(id);
    const variant = goodsVariant(item);

    if (!entry.variants.includes(variant)) {
      entry.variants.push(variant);
    }
  }

  return [...entries.values()];
}

function goodsAvailableTypes(member, catalog = goodsCatalogEntries()) {
  const configured = db.goodsTypeNames?.[member];
  const defaults = Array.isArray(configured)
    ? configured
    : goodsDefaultTypes;

  return [
    ...new Set([
      ...defaults,
      ...catalog
        .filter((entry) => entry.member === member)
        .map((entry) => entry.type)
    ])
  ].filter(Boolean);
}

function currentGoodsEntry(series = goodsBrowserState.series) {
  const state = goodsBrowserState;

  return goodsCatalogEntries().find(
    (entry) =>
      entry.id === goodsCatalogId(state.member, state.type, series)
  );
}

function goodsMatches(item, entry, variant = null) {
  return (
    goodsMember(item) === entry.member &&
    goodsType(item) === entry.type &&
    goodsSeries(item) === entry.series &&
    (variant === null || goodsVariant(item) === variant)
  );
}

function goodsRecords(
  entry,
  variant = null,
  inventory = goodsBrowserState.inventory
) {
  return db.goods.filter(
    (item) =>
      goodsMatches(item, entry, variant) &&
      goodsInventory(item) === inventory
  );
}

function goodsUnit(entry) {
  return entry?.unit || (
    /カード/.test(entry?.type || goodsBrowserState.type)
      ? '枚'
      : '個'
  );
}

function commitGoods(records, catalog) {
  const previous = db.goods;
  const previousCatalog = db.goodsCatalog;

  db.goods = records;
  db.goodsCatalog = catalog;

  try {
    save();
  } catch {
    db.goods = previous;
    db.goodsCatalog = previousCatalog;

    toast('グッズを保存できませんでした。空き容量を確認してください');
    return false;
  }

  renderGoodsBrowser();
  return true;
}

function goodsThumbnail(entry) {
  return `
    <span
      class="goods-thumb"
      aria-hidden="true"
      ${
        entry?.iconId
          ? `data-goods-icon="${escapeHtml(entry.iconId)}"
             data-goods-crop="${escapeHtml(JSON.stringify(entry.crop || null))}"`
          : ''
      }
    >${entry?.iconId ? '' : '▧'}</span>
  `;
}

function loadGoodsImages(container) {
  container.querySelectorAll(
    '[data-goods-image], [data-goods-icon]'
  ).forEach(async (element) => {
    try {
      const url = await getPhotoURL(
        element.dataset.goodsImage || element.dataset.goodsIcon
      );

      if (!url || !element.isConnected) return;

      const image = new Image();
      image.alt = element.dataset.goodsIcon ? '' : '登録したグッズ';

      if (element.dataset.goodsIcon) {
        image.onload = () => {
          let crop = null;

          try {
            crop = JSON.parse(element.dataset.goodsCrop || 'null');
          } catch {}

          if (element.isConnected) {
            applyAvatarCrop(image, crop);
          }
        };
      }

      image.src = url;
      element.replaceChildren(image);
    } catch {
      if (element.isConnected) {
        element.textContent = '画像を読み込めませんでした';
      }
    }
  });
}

function goodsRow(action, value, title, detail, thumbnail = '') {
  return `
    <button
      type="button"
      class="goods-row"
      data-goods-${action}="${escapeHtml(value)}"
    >
      ${thumbnail}

      <span class="goods-row-main">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>

      <span aria-hidden="true">›</span>
    </button>
  `;
}

function renderGoodsBrowser() {
  const container = $('#goodsContent');
  if (!container) return;

  const state = goodsBrowserState;
  const catalog = goodsCatalogEntries();
  const entry = state.series ? currentGoodsEntry() : null;

  $('#page-goods').querySelectorAll('[data-goods-view]').forEach(
    (button) => {
      const active = button.dataset.goodsView === state.inventory;

      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  );

  $('#goodsBack').hidden = !state.member;
  $('#goodsBack').textContent = state.series
    ? '‹ シリーズへ'
    : state.type
      ? '‹ 種類へ'
      : '‹ メンバーへ';

  $('#goodsTitle').textContent =
    state.series || state.type || state.member || 'メンバーを選ぶ';

  $('#goodsCrumb').textContent = [
    state.member,
    state.type,
    state.series ? goodsInventoryLabel(state.inventory) : ''
  ].filter(Boolean).join(' / ');

  $('#goodsSearch').placeholder = !state.member
    ? 'メンバーを検索'
    : !state.type
      ? '種類を検索'
      : !state.series
        ? 'シリーズを検索'
        : '絵柄・商品・メモを検索';

  $('#goodsSearch').setAttribute(
    'aria-label',
    $('#goodsSearch').placeholder
  );

  $('#goodsSearch').value = state.query;
  $('#goodsFavoritesOnly').checked = state.favoritesOnly;
  $('#goodsAddKind').hidden = !state.member || !!state.type;
  $('#goodsAddSeries').hidden = !state.type || !!state.series;
  $('#goodsAddVariant').hidden = !entry;
  $('#goodsRenameGroup').hidden = !state.type;
  $('#goodsIconControls').hidden = !state.type;

  const iconEntry = state.type
    ? currentGoodsEntry(state.series || '')
    : null;

  $('#goodsIconPreview').innerHTML = state.type
    ? goodsThumbnail(iconEntry)
    : '';

  $('#goodsRemoveIcon').disabled =
    goodsBrowserBusy || !iconEntry?.iconId;

  $('#goodsChooseIcon').disabled = goodsBrowserBusy;

  $('#goodsCropIcon').disabled =
    goodsBrowserBusy || !iconEntry?.iconId;

  container.classList.toggle('goods-variant-grid', !!entry);

  const query = normalize(state.query);

  if (!state.member) {
    const names = [
      ...new Set([
        ...members.map((item) => item.name),
        '共通・集合',
        ...catalog.map((item) => item.member)
      ])
    ];

    const visible = names.filter((name) =>
      normalize(
        `${name} ${
          members.find((item) => item.name === name)?.kana || ''
        }`
      ).includes(query)
    );

    container.innerHTML = visible.map((name) => {
      const kinds = goodsAvailableTypes(name, catalog).length;

      const total = db.goods
        .filter(
          (item) =>
            goodsMember(item) === name &&
            goodsInventory(item) === state.inventory
        )
        .reduce((sum, item) => sum + goodsCount(item), 0);

      return goodsRow(
        'member',
        name,
        name,
        `${kinds}種類 / ${goodsInventoryLabel(state.inventory)} ${total}点`
      );
    }).join('') || empty('メンバーが見つかりません');

    $('#goodsSummary').textContent =
      `${visible.length}人・共通グッズ`;
  } else if (!state.type) {
    const types = goodsAvailableTypes(state.member, catalog).filter(
      (type) => normalize(type).includes(query)
    );

    container.innerHTML = types.map((type) => {
      const entries = catalog.filter(
        (item) =>
          item.member === state.member &&
          item.type === type
      );

      const thumbnail =
        entries.find((item) => !item.series && item.iconId) ||
        entries.find((item) => item.iconId);

      const total = db.goods
        .filter(
          (item) =>
            goodsMember(item) === state.member &&
            goodsType(item) === type &&
            goodsInventory(item) === state.inventory
        )
        .reduce((sum, item) => sum + goodsCount(item), 0);

      return goodsRow(
        'type',
        type,
        type,
        `${entries.filter((item) => item.series).length}シリーズ / ${
          goodsInventoryLabel(state.inventory)
        } ${total}点`,
        goodsThumbnail(thumbnail)
      );
    }).join('') || empty(
      '「種類を追加」から、缶バッジやクリアカードなどを登録できます。'
    );

    $('#goodsSummary').textContent = `${types.length}種類`;
  } else if (!entry) {
    const entries = catalog.filter(
      (item) =>
        item.member === state.member &&
        item.type === state.type &&
        item.series &&
        normalize(item.series).includes(query)
    );

    container.innerHTML = entries.map((item) => {
      const records = goodsRecords(item);

      const total = records.reduce(
        (sum, row) => sum + goodsCount(row),
        0
      );

      return goodsRow(
        'series',
        item.series,
        item.series,
        `${item.variants.length}絵柄 / ${
          goodsInventoryLabel(state.inventory)
        } ${total}${goodsUnit(item)}`,
        goodsThumbnail(item)
      );
    }).join('') || empty(
      '「シリーズを追加」から、ツアー名や商品シリーズを登録できます。'
    );

    $('#goodsSummary').textContent = `${entries.length}シリーズ`;
  } else {
    const records = goodsRecords(entry);

    const variants = entry.variants.filter((variant) => {
      const items = records.filter(
        (item) => goodsVariant(item) === variant
      );

      return (
        (
          !state.favoritesOnly ||
          items.some((item) => item.favorite)
        ) &&
        normalize(
          [
            variant,
            ...items.flatMap((item) => [item.title, item.note])
          ].join(' ')
        ).includes(query)
      );
    });

    const owned = entry.variants.filter((variant) =>
      goodsRecords(entry, variant).some(
        (item) => goodsCount(item) > 0
      )
    ).length;

    $('#goodsSummary').textContent =
      `${goodsInventoryLabel(state.inventory)} ${
        owned
      } / ${entry.variants.length}絵柄`;

    container.innerHTML = variants.map((variant) => {
      const items = goodsRecords(entry, variant);

      const count = items.reduce(
        (sum, item) => sum + goodsCount(item),
        0
      );

      const image = items.find((item) => item.imageId);
      const favorite = items.some((item) => item.favorite);
      const key = escapeHtml(variant);

      return `
        <article class="goods-variant">
          <h4>${key}</h4>

          <button
            type="button"
            class="goods-product-image"
            data-goods-edit-variant="${key}"
            aria-label="${key}の画像・登録内容を編集"
          >
            <span
              ${
                image
                  ? `data-goods-image="${escapeHtml(image.imageId)}"`
                  : ''
              }
            >${
              count
                ? '画像なし'
                : state.inventory === 'collection'
                  ? '未所持'
                  : '未登録'
            }</span>
          </button>

          <div class="goods-counter">
            <button
              type="button"
              data-goods-count="${key}"
              data-delta="-1"
              aria-label="${key}を1減らす"
              ${!count ? 'disabled' : ''}
            >−</button>

            <strong>${count}${escapeHtml(goodsUnit(entry))}</strong>

            <button
              type="button"
              data-goods-count="${key}"
              data-delta="1"
              aria-label="${key}を1増やす"
              ${count >= 99999 ? 'disabled' : ''}
            >＋</button>
          </div>

          <div class="goods-actions">
            <button
              type="button"
              data-goods-inventory="offer"
              data-variant="${key}"
            >提供</button>

            <button
              type="button"
              data-goods-inventory="want"
              data-variant="${key}"
            >希望</button>

            <button
              type="button"
              data-goods-favorite="${key}"
              aria-pressed="${favorite}"
              aria-label="${key}のお気に入り"
            >${favorite ? '★' : '☆'}</button>

            <button
              type="button"
              data-goods-edit-variant="${key}"
            >編集・画像</button>
          </div>

          <div class="goods-actions">
            <button
              type="button"
              data-goods-rename-variant="${key}"
            >絵柄名を変更</button>

            <button
              type="button"
              data-goods-remove-variant="${key}"
            >削除</button>
          </div>

          ${
            items.length > 1
              ? `<small>${items.length}件を合算・個別の編集は登録済み一覧へ</small>`
              : ''
          }
        </article>
      `;
    }).join('') || empty(
      '絵柄がありません。「追加」から登録できます。'
    );
  }

  const saved = db.goods.filter(
    (item) =>
      goodsInventory(item) === state.inventory &&
      (!state.member || goodsMember(item) === state.member) &&
      (!state.type || goodsType(item) === state.type) &&
      (!state.series || goodsSeries(item) === state.series) &&
      (!state.favoritesOnly || item.favorite) &&
      normalize(
        [
          goodsMember(item),
          goodsType(item),
          goodsSeries(item),
          goodsVariant(item),
          item.note
        ].join(' ')
      ).includes(query)
  );

  $('#list-goods').innerHTML = saved.map((item) => {
    const entry = catalog.find(
      (entry) => goodsMatches(item, entry)
    );

    return `
      <div class="data-row">
        <div class="data-main">
          <strong>
            ${escapeHtml(item.title || goodsVariant(item))}
          </strong>

          <small>
            ${escapeHtml(
              [
                goodsMember(item),
                goodsType(item),
                goodsSeries(item),
                goodsVariant(item)
              ].join(' / ')
            )}
          </small>

          <small>
            ${goodsCount(item)}${escapeHtml(goodsUnit(entry))}
          </small>

          ${
            item.note
              ? `<small>${escapeHtml(item.note)}</small>`
              : ''
          }
        </div>

        <button
          type="button"
          class="subtle"
          data-goods-edit="${escapeHtml(item.id)}"
        >編集</button>

        <button
          type="button"
          class="del"
          data-goods-delete="${escapeHtml(item.id)}"
        >削除</button>
      </div>
    `;
  }).join('') || empty('この条件の登録はありません');

  loadGoodsImages($('#page-goods'));
}

function addGoodsGroup(level) {
  const state = goodsBrowserState;

  const value = prompt(
    level === 'type'
      ? 'グッズの種類（例：缶バッジ、クリアカード）'
      : level === 'series'
        ? 'シリーズ名（例：5th TOUR 2025）'
        : '絵柄名（例：A、B、通常）'
  );

  if (value === null) return;

  const name = value.trim();

  if (!name || name.length > 80) {
    toast('名前は1〜80文字で入力してください');
    return;
  }

  const type = level === 'type' ? name : state.type;

  const series = level === 'type'
    ? ''
    : level === 'series'
      ? name
      : state.series;

  const catalog = goodsCatalogEntries();
  const id = goodsCatalogId(state.member, type, series);

  let entry = catalog.find((item) => item.id === id);

  if (
    level !== 'variant' &&
    (
      entry ||
      (
        level === 'type' &&
        goodsAvailableTypes(state.member, catalog).includes(name)
      )
    )
  ) {
    toast('同じ名前は登録済みです');
    return;
  }

  if (!entry) {
    entry = {
      id,
      member: state.member,
      type,
      series,
      variants: [],
      unit: /カード/.test(type) ? '枚' : '個'
    };

    catalog.push(entry);
  }

  if (level === 'variant') {
    if (entry.variants.includes(name)) {
      toast('その絵柄は登録済みです');
      return;
    }

    entry.variants.push(name);
  }

  if (commitGoods(db.goods, catalog)) {
    toast('追加しました');
  }
}

function changeGoodsCount(variant, delta, favorite = false) {
  const entry = currentGoodsEntry();
  if (!entry) return;

  const items = goodsRecords(entry, variant);

  const total = items.reduce(
    (sum, item) => sum + goodsCount(item),
    0
  );

  if (
    !favorite &&
    (total + delta < 0 || total + delta > 99999)
  ) {
    return;
  }

  const records = db.goods.map((item) => ({ ...item }));

  const target = delta < 0
    ? items.find((item) => goodsCount(item) > 0)
    : items[0];

  let row = target && records.find(
    (item) => item.id === target.id
  );

  if (!row) {
    row = {
      id: crypto.randomUUID(),
      member: entry.member,
      type: entry.type,
      series: entry.series,
      variant,
      title: variant,
      inventory: goodsBrowserState.inventory,
      count: 0
    };

    records.push(row);
  }

  if (favorite) {
    const next = !items.some((item) => item.favorite);

    for (const item of records.filter(
      (item) =>
        goodsMatches(item, entry, variant) &&
        goodsInventory(item) === goodsBrowserState.inventory
    )) {
      item.favorite = false;
    }

    row.favorite = next;
  } else {
    row.count = goodsCount(row) + delta;
    row.status = row.count ? '所持' : '未所持';
  }

  if (commitGoods(records, goodsCatalogEntries())) {
    const attribute = favorite
      ? 'data-goods-favorite'
      : 'data-goods-count';

    [...$('#goodsContent').querySelectorAll(`[${attribute}]`)]
      .find(
        (button) =>
          button.getAttribute(attribute) === variant &&
          (
            favorite ||
            Number(button.dataset.delta) === delta
          )
      )
      ?.focus({ preventScroll: true });
  }
}

function renameGoodsGroup(variant = null) {
  const state = goodsBrowserState;
  const old = variant || state.series || state.type;
  const value = prompt('新しい名前', old);

  if (value === null) return;

  const next = value.trim();

  if (!next || next.length > 80) {
    toast('名前は1〜80文字で入力してください');
    return;
  }

  if (next === old) return;

  const catalog = goodsCatalogEntries();

  const duplicate = variant
    ? currentGoodsEntry()?.variants.includes(next)
    : state.series
      ? catalog.some(
          (entry) =>
            entry.member === state.member &&
            entry.type === state.type &&
            entry.series === next
        )
      : goodsAvailableTypes(state.member, catalog).includes(next);

  if (duplicate) {
    toast('その名前は登録済みです');
    return;
  }

  const records = db.goods.map((item) => {
    const match =
      goodsMember(item) === state.member &&
      goodsType(item) === state.type &&
      (!state.series || goodsSeries(item) === state.series);

    if (!match) return item;

    if (variant) {
      return goodsVariant(item) === variant
        ? { ...item, variant: next }
        : item;
    }

    return state.series
      ? { ...item, series: next }
      : { ...item, type: next };
  });

  for (const entry of catalog) {
    if (
      entry.member !== state.member ||
      entry.type !== state.type ||
      (state.series && entry.series !== state.series)
    ) {
      continue;
    }

    if (variant) {
      entry.variants = entry.variants.map(
        (name) => name === variant ? next : name
      );
    } else if (state.series) {
      entry.series = next;
    } else {
      entry.type = next;
    }

    entry.id = goodsCatalogId(
      entry.member,
      entry.type,
      entry.series
    );
  }

  const previousTypeNames = db.goodsTypeNames;
  const renamingType = !variant && !state.series;

  if (renamingType) {
    db.goodsTypeNames = {
      ...previousTypeNames,
      [state.member]: goodsAvailableTypes(state.member).map(
        (name) => name === old ? next : name
      )
    };
  }

  if (commitGoods(records, catalog)) {
    if (!variant) {
      if (state.series) {
        state.series = next;
      } else {
        state.type = next;
      }

      renderGoodsBrowser();
    }

    toast('名前を変更しました');
  } else if (renamingType) {
    if (previousTypeNames === undefined) {
      delete db.goodsTypeNames;
    } else {
      db.goodsTypeNames = previousTypeNames;
    }
  }
}

function cleanupGoodsImage(id) {
  if (id && !imageInUse(id)) {
    deletePhoto(id).catch(() => {});
  }
}

function removeGoodsVariant(variant) {
  const entry = currentGoodsEntry();
  if (!entry) return;

  if (
    !confirm(
      `「${variant}」の絵柄と、所持・提供・希望の登録を削除しますか？`
    )
  ) {
    return;
  }

  const removed = db.goods.filter(
    (item) => goodsMatches(item, entry, variant)
  );

  const catalog = goodsCatalogEntries();

  catalog.find((item) => item.id === entry.id).variants =
    entry.variants.filter((name) => name !== variant);

  if (
    commitGoods(
      db.goods.filter(
        (item) => !goodsMatches(item, entry, variant)
      ),
      catalog
    )
  ) {
    removed.forEach(
      (item) => cleanupGoodsImage(item.imageId)
    );
  }
}

async function editGoodsIcon(file = null) {
  if (goodsBrowserBusy) return;

  const state = { ...goodsBrowserState };
  if (!state.type) return;

  const id = goodsCatalogId(
    state.member,
    state.type,
    state.series || ''
  );

  const previous = goodsCatalogEntries().find(
    (entry) => entry.id === id
  );

  if (file && !file.type.startsWith('image/')) {
    toast('画像を選んでください');
    return;
  }

  goodsBrowserBusy = true;
  renderGoodsBrowser();

  let newId;
  let persisted = false;

  try {
    const source = file || (
      previous?.iconId
        ? await getPhotoURL(previous.iconId)
        : null
    );

    if (!source) return;

    const crop = await chooseImageCrop(source, {
      round: true,
      initialCrop: file ? null : previous?.crop
    });

    if (!crop) return;

    if (file) {
      newId = `goods-icon-${crypto.randomUUID()}`;
      await savePhoto(newId, file);
    }

    const catalog = goodsCatalogEntries();

    let entry = catalog.find((entry) => entry.id === id);

    if (!entry) {
      entry = {
        id,
        member: state.member,
        type: state.type,
        series: state.series || '',
        variants: [],
        unit: goodsUnit(previous)
      };

      catalog.push(entry);
    }

    entry.iconId = newId || previous.iconId;
    entry.crop = crop;

    persisted = commitGoods(db.goods, catalog);

    if (persisted && newId) {
      cleanupGoodsImage(previous?.iconId);
    }
  } catch {
    toast('アイコンを保存できませんでした');
  } finally {
    if (newId && !persisted) {
      deletePhoto(newId).catch(() => {});
    }

    goodsBrowserBusy = false;
    renderGoodsBrowser();
  }
}

function removeGoodsIcon() {
  const entry = currentGoodsEntry(
    goodsBrowserState.series || ''
  );

  if (!entry?.iconId) return;

  if (
    !confirm(
      '一覧用のアイコンを解除しますか？商品の画像と個数は残ります。'
    )
  ) {
    return;
  }

  const catalog = goodsCatalogEntries();
  const target = catalog.find((item) => item.id === entry.id);

  delete target.iconId;
  delete target.crop;

  if (commitGoods(db.goods, catalog)) {
    cleanupGoodsImage(entry.iconId);
  }
}

function openGoodsForm(item = null, defaults = {}) {
  if (goodsBrowserBusy) return;

  const state = goodsBrowserState;

  const values = item
    ? {
        ...item,
        member: goodsMember(item),
        type: goodsType(item),
        series: goodsSeries(item),
        variant: goodsVariant(item),
        inventory: goodsInventory(item),
        count: goodsCount(item)
      }
    : {
        member: state.member || '共通・集合',
        type: state.type,
        series: state.series,
        variant: '通常',
        inventory: state.inventory,
        count: 1,
        ...defaults
      };

  goodsEditingId = item?.id ?? null;

  const form = $('#goodsForm');
  form.reset();

  $('#goodsModalTitle').textContent =
    item ? 'グッズを編集' : 'グッズを登録';

  const memberSelect = form.elements.member;

  memberSelect.replaceChildren(
    ...[
      ...new Set([
        '共通・集合',
        ...members.map((item) => item.name),
        ...db.goods.map(goodsMember),
        values.member
      ])
    ].map((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      return option;
    })
  );

  for (const name of [
    'member',
    'type',
    'series',
    'variant',
    'inventory',
    'title',
    'note'
  ]) {
    form.elements[name].value = values[name] ?? '';
  }

  form.elements.count.value = values.count;

  const entry = goodsCatalogEntries().find(
    (entry) =>
      entry.member === values.member &&
      entry.type === values.type &&
      entry.series === values.series
  );

  form.elements.unit.value = goodsUnit(
    entry || { type: values.type }
  );

  $('#goodsRemoveImageLabel').hidden = !item?.imageId;

  const entries = goodsCatalogEntries();

  const updateTypeOptions = () => {
    $('#goodsTypeOptions').replaceChildren(
      ...goodsAvailableTypes(
        form.elements.member.value,
        entries
      ).map((value) => {
        const option = document.createElement('option');
        option.value = value;
        return option;
      })
    );
  };

  form.elements.member.onchange = updateTypeOptions;
  updateTypeOptions();

  $('#goodsSeriesOptions').replaceChildren(
    ...[
      ...new Set(
        entries.map((entry) => entry.series).filter(Boolean)
      )
    ].map((value) => {
      const option = document.createElement('option');
      option.value = value;
      return option;
    })
  );

  $('#goodsModal').classList.add('open');
  form.elements.type.focus();
}

function editGoodsVariant(
  variant,
  inventory = goodsBrowserState.inventory
) {
  const entry = currentGoodsEntry();
  if (!entry) return;

  const items = goodsRecords(entry, variant, inventory);

  openGoodsForm(
    items.find((item) => goodsCount(item) > 0) ||
    items[0] ||
    null,
    { variant, inventory }
  );
}

async function saveGoodsForm(event) {
  event.preventDefault();

  if (goodsBrowserBusy) return;

  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const data = new FormData(form);

  const original = db.goods.find(
    (item) => item.id === goodsEditingId
  );

  const item = {
    ...original,
    id: original?.id || crypto.randomUUID()
  };

  for (const name of [
    'member',
    'type',
    'series',
    'variant',
    'title',
    'note',
    'inventory'
  ]) {
    item[name] = String(data.get(name) || '').trim();
  }

  const unit = String(data.get('unit') || '').trim();
  item.count = Number(data.get('count'));

  if (
    !['collection', 'offer', 'want'].includes(item.inventory) ||
    !Number.isSafeInteger(item.count) ||
    item.count < 0 ||
    item.count > 99999
  ) {
    toast('個数は0〜99999の整数で入力してください');
    return;
  }

  if (
    ['member', 'type', 'series', 'variant'].some(
      (name) => !item[name] || item[name].length > 80
    ) ||
    !unit ||
    unit.length > 12
  ) {
    toast('種類・シリーズ・絵柄は1〜80文字、単位は1〜12文字で入力してください');
    return;
  }

  item.title = item.title || item.variant;
  item.status = item.count ? '所持' : '未所持';

  const file = form.elements.photo.files[0];

  if (file && !file.type.startsWith('image/')) {
    toast('画像ファイルを選んでください');
    return;
  }

  goodsBrowserBusy = true;
  form.querySelector('[type="submit"]').disabled = true;

  let newId;
  let persisted = false;

  try {
    if (file) {
      const url = URL.createObjectURL(file);

      try {
        const image = new Image();
        image.src = url;
        await image.decode();
      } finally {
        URL.revokeObjectURL(url);
      }

      newId = `goods-image-${crypto.randomUUID()}`;
      await savePhoto(newId, file);
      item.imageId = newId;
    } else if (form.elements.removeImage.checked) {
      delete item.imageId;
    }

    const catalog = goodsCatalogEntries();

    const id = goodsCatalogId(
      item.member,
      item.type,
      item.series
    );

    let entry = catalog.find((entry) => entry.id === id);

    if (!entry) {
      entry = {
        id,
        member: item.member,
        type: item.type,
        series: item.series,
        variants: [],
        unit
      };

      catalog.push(entry);
    }

    if (!entry.variants.includes(item.variant)) {
      entry.variants.push(item.variant);
    }

    entry.unit = unit;

    const records = original
      ? db.goods.map(
          (row) => row.id === original.id ? item : row
        )
      : [item, ...db.goods];

    persisted = commitGoods(records, catalog);

    if (!persisted) return;

    Object.assign(goodsBrowserState, {
      member: item.member,
      type: item.type,
      series: item.series,
      inventory: item.inventory,
      query: '',
      favoritesOnly: false
    });

    $('#goodsModal').classList.remove('open');
    renderGoodsBrowser();

    if (
      original?.imageId &&
      original.imageId !== item.imageId
    ) {
      cleanupGoodsImage(original.imageId);
    }

    toast('グッズを保存しました');
  } catch {
    toast('グッズを保存できませんでした。画像と空き容量を確認してください');
  } finally {
    if (newId && !persisted) {
      deletePhoto(newId).catch(() => {});
    }

    goodsBrowserBusy = false;
    form.querySelector('[type="submit"]').disabled = false;
  }
}

function initGoodsBrowser() {
  const page = $('#page-goods');

  page.querySelector('.page-head p').textContent =
    'メンバー・種類・シリーズごとに、自分のグッズを登録。';

  const add = page.querySelector('[data-add="goods"]');
  add.removeAttribute('data-add');
  add.dataset.goodsAdd = '';

  page.querySelector('.panel').innerHTML = `
    <div
      class="collection-tabs"
      role="group"
      aria-label="グッズの表示"
    >
      <button
        type="button"
        class="secondary"
        data-goods-view="collection"
      >所持</button>

      <button
        type="button"
        class="secondary"
        data-goods-view="offer"
      >提供</button>

      <button
        type="button"
        class="secondary"
        data-goods-view="want"
      >希望</button>
    </div>

    <div class="goods-browser">
      <button
        type="button"
        class="goods-back"
        id="goodsBack"
        hidden
      >‹ メンバーへ</button>

      <p id="goodsCrumb" class="goods-crumb"></p>
      <h3 id="goodsTitle" tabindex="-1">メンバーを選ぶ</h3>

      <div class="goods-filters">
        <input
          type="search"
          id="goodsSearch"
          placeholder="メンバーを検索"
          aria-label="メンバーを検索"
        >

        <label>
          <input type="checkbox" id="goodsFavoritesOnly">
          お気に入りのみ（絵柄一覧）
        </label>
      </div>

      <div
        class="goods-icon-controls"
        id="goodsIconControls"
        hidden
      >
        <span id="goodsIconPreview"></span>
        <span>一覧用アイコン</span>

        <input
          type="file"
          id="goodsIconFile"
          accept="image/*"
          hidden
        >

        <button
          type="button"
          class="subtle"
          id="goodsChooseIcon"
        >画像を選ぶ・変更</button>

        <button
          type="button"
          class="subtle"
          id="goodsCropIcon"
        >切り取り</button>

        <button
          type="button"
          class="subtle"
          id="goodsRemoveIcon"
        >解除</button>
      </div>

      <p
        id="goodsSummary"
        class="goods-summary"
        aria-live="polite"
      ></p>

      <div id="goodsContent" class="goods-content"></div>

      <div class="goods-toolbar">
        <button
          type="button"
          class="subtle"
          id="goodsAddKind"
          hidden
        >＋ 種類を追加</button>

        <button
          type="button"
          class="subtle"
          id="goodsAddSeries"
          hidden
        >＋ シリーズを追加</button>

        <button
          type="button"
          class="subtle"
          id="goodsAddVariant"
          hidden
        >＋ 追加</button>

        <button
          type="button"
          class="subtle"
          id="goodsRenameGroup"
          hidden
        >名前を変更</button>

        <button
          type="button"
          class="primary"
          data-goods-add
        >＋ 商品を登録</button>
      </div>

      <details class="goods-saved">
        <summary>登録済み一覧・個別の編集と削除</summary>
        <div class="data-list" id="list-goods"></div>
      </details>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'goodsModal';
  modal.className = 'modal-wrap';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'goodsModalTitle');

  modal.innerHTML = `
    <div class="modal">
      <h3 id="goodsModalTitle">グッズを登録</h3>

      <form id="goodsForm">
        <div class="form-grid">
          <div class="field">
            <label for="goodsFieldMember">メンバー *</label>
            <select
              name="member"
              id="goodsFieldMember"
              required
            ></select>
          </div>

          <div class="field">
            <label for="goodsFieldType">種類 *</label>
            <input
              name="type"
              id="goodsFieldType"
              list="goodsTypeOptions"
              maxlength="80"
              placeholder="缶バッジ、クリアカードなど"
              required
            >
            <datalist id="goodsTypeOptions"></datalist>
          </div>

          <div class="field">
            <label for="goodsFieldSeries">シリーズ *</label>
            <input
              name="series"
              id="goodsFieldSeries"
              list="goodsSeriesOptions"
              maxlength="80"
              placeholder="ツアー名・商品シリーズなど"
              required
            >
            <datalist id="goodsSeriesOptions"></datalist>
          </div>

          <div class="field">
            <label for="goodsFieldVariant">絵柄・種類名 *</label>
            <input
              name="variant"
              id="goodsFieldVariant"
              maxlength="80"
              placeholder="A、B、通常など"
              required
            >
          </div>

          <div class="field full">
            <label for="goodsFieldTitle">商品名・管理名（任意）</label>
            <input
              name="title"
              id="goodsFieldTitle"
              maxlength="160"
            >
          </div>

          <div class="field">
            <label for="goodsFieldInventory">管理先 *</label>
            <select
              name="inventory"
              id="goodsFieldInventory"
              required
            >
              <option value="collection">所持</option>
              <option value="offer">提供</option>
              <option value="want">希望</option>
            </select>
          </div>

          <div class="field">
            <label for="goodsFieldCount">個数 *</label>
            <input
              type="number"
              name="count"
              id="goodsFieldCount"
              min="0"
              max="99999"
              step="1"
              required
            >
          </div>

          <div class="field">
            <label for="goodsFieldUnit">表示単位 *</label>
            <input
              name="unit"
              id="goodsFieldUnit"
              maxlength="12"
              placeholder="個、枚、本、セットなど"
              required
            >
          </div>

          <div class="field full">
            <label for="goodsFieldPhoto">商品画像（任意）</label>
            <input
              type="file"
              name="photo"
              id="goodsFieldPhoto"
              accept="image/*"
            >

            <small>
              画像を選ばなければ現在の画像を保持します。
            </small>

            <label id="goodsRemoveImageLabel" hidden>
              <input type="checkbox" name="removeImage">
              現在の画像を解除
            </label>
          </div>

          <div class="field full">
            <label for="goodsFieldNote">メモ</label>
            <textarea
              name="note"
              id="goodsFieldNote"
            ></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button
            type="button"
            class="secondary"
            id="goodsCancel"
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

  const close = () => {
    if (!goodsBrowserBusy) {
      modal.classList.remove('open');
    }
  };

  $('#goodsCancel').onclick = close;

  modal.onclick = (event) => {
    if (event.target === modal) close();
  };

  $('#goodsForm').onsubmit = saveGoodsForm;

  $('#goodsSearch').oninput = (event) => {
    goodsBrowserState.query = event.target.value;
    renderGoodsBrowser();
  };

  $('#goodsFavoritesOnly').onchange = (event) => {
    goodsBrowserState.favoritesOnly = event.target.checked;
    renderGoodsBrowser();
  };

  $('#goodsBack').onclick = () => {
    const state = goodsBrowserState;

    if (state.series) {
      state.series = '';
    } else if (state.type) {
      state.type = '';
    } else {
      state.member = '';
    }

    state.query = '';

    renderGoodsBrowser();
    $('#goodsTitle').focus();
  };

  $('#goodsAddKind').onclick = () => addGoodsGroup('type');
  $('#goodsAddSeries').onclick = () => addGoodsGroup('series');
  $('#goodsAddVariant').onclick = () => addGoodsGroup('variant');
  $('#goodsRenameGroup').onclick = () => renameGoodsGroup();

  $('#goodsChooseIcon').onclick = () => {
    $('#goodsIconFile').click();
  };

  $('#goodsCropIcon').onclick = () => editGoodsIcon();
  $('#goodsRemoveIcon').onclick = removeGoodsIcon;

  $('#goodsIconFile').onchange = (event) => {
    const file = event.target.files[0];
    event.target.value = '';

    if (file) editGoodsIcon(file);
  };

  page.addEventListener('click', (event) => {
    const button = event.target.closest('button');

    if (!button || goodsBrowserBusy) return;

    const state = goodsBrowserState;

    if (button.hasAttribute('data-goods-add')) {
      openGoodsForm();
    } else if (button.hasAttribute('data-goods-view')) {
      state.inventory = button.dataset.goodsView;
      renderGoodsBrowser();
    } else if (button.hasAttribute('data-goods-member')) {
      state.member = button.dataset.goodsMember;
      state.type = '';
      state.series = '';
      state.query = '';

      renderGoodsBrowser();
      $('#goodsTitle').focus();
    } else if (button.hasAttribute('data-goods-type')) {
      state.type = button.dataset.goodsType;
      state.series = '';
      state.query = '';

      renderGoodsBrowser();
      $('#goodsTitle').focus();
    } else if (button.hasAttribute('data-goods-series')) {
      state.series = button.dataset.goodsSeries;
      state.query = '';

      renderGoodsBrowser();
      $('#goodsTitle').focus();
    } else if (button.hasAttribute('data-goods-count')) {
      changeGoodsCount(
        button.dataset.goodsCount,
        Number(button.dataset.delta)
      );
    } else if (button.hasAttribute('data-goods-favorite')) {
      changeGoodsCount(button.dataset.goodsFavorite, 0, true);
    } else if (button.hasAttribute('data-goods-edit-variant')) {
      editGoodsVariant(button.dataset.goodsEditVariant);
    } else if (button.hasAttribute('data-goods-inventory')) {
      editGoodsVariant(
        button.dataset.variant,
        button.dataset.goodsInventory
      );
    } else if (button.hasAttribute('data-goods-rename-variant')) {
      renameGoodsGroup(button.dataset.goodsRenameVariant);
    } else if (button.hasAttribute('data-goods-remove-variant')) {
      removeGoodsVariant(button.dataset.goodsRemoveVariant);
    } else if (button.hasAttribute('data-goods-edit')) {
      openGoodsForm(
        db.goods.find(
          (item) => String(item.id) === button.dataset.goodsEdit
        )
      );
    } else if (button.hasAttribute('data-goods-delete')) {
      const item = db.goods.find(
        (item) => String(item.id) === button.dataset.goodsDelete
      );

      if (
        !item ||
        !confirm(
          'このグッズの登録を削除しますか？絵柄は一覧に残ります。'
        )
      ) {
        return;
      }

      if (
        commitGoods(
          db.goods.filter((row) => row !== item),
          goodsCatalogEntries()
        )
      ) {
        cleanupGoodsImage(item.imageId);
      }
    }
  });

  renderGoodsBrowser();
}
