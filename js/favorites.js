'use strict';

const homeFavoriteLimit = 6;

const homeFavoriteEditorState = {
  ids: [],
  query: '',
  shown: 40
};

function favoritePhotos() {
  return db.photos
    .filter((item) => item.favorite)
    .sort((a, b) => (b.favoriteAt || 0) - (a.favoriteAt || 0));
}

function homeFavoritePhotos() {
  const all = favoritePhotos();

  if (!Array.isArray(db.homeFavoritePhotoIds)) {
    return all.slice(0, homeFavoriteLimit);
  }

  const records = new Map(
    all.map((item) => [String(item.id), item])
  );

  return [...new Set(db.homeFavoritePhotoIds.map(String))]
    .map((id) => records.get(id))
    .filter(Boolean)
    .slice(0, homeFavoriteLimit);
}

function favoritePhotoLabel(item) {
  return [item.member, item.series, item.pose]
    .filter(Boolean)
    .join(' / ');
}

function loadFavoriteImages(container) {
  container.querySelectorAll('[data-favorite-image]').forEach(
    async (element) => {
      try {
        const url = await getPhotoURL(element.dataset.favoriteImage);

        if (!url || !element.isConnected) return;

        const image = new Image();
        image.alt = 'お気に入りの生写真';
        image.src = url;

        element.replaceChildren(image);
      } catch {
        if (element.isConnected) {
          element.textContent = '画像を読み込めませんでした';
        }
      }
    }
  );
}

function togglePhotoFavorite(id) {
  const item = db.photos.find(
    (photo) => String(photo.id) === String(id)
  );

  if (!item) return;

  const previous = item.favorite;
  const previousAt = item.favoriteAt;

  item.favorite = !item.favorite;
  item.favoriteAt = item.favorite ? Date.now() : undefined;

  try {
    save();
  } catch {
    item.favorite = previous;
    item.favoriteAt = previousAt;

    toast('お気に入りを保存できませんでした');
    return;
  }

  render();

  const card = [
    ...document.querySelectorAll('[data-photo-record]')
  ].find(
    (element) => element.dataset.photoRecord === String(id)
  );

  (
    card?.querySelector('[data-favorite-photo]') ||
    $('#photoFavoritesOnly')
  )?.focus({ preventScroll: true });

  toast(
    item.favorite
      ? 'お気に入りに追加しました'
      : 'お気に入りを解除しました'
  );
}

function renderHomeFavorites() {
  initHomeFavoriteEditor();

  const all = favoritePhotos();
  const items = homeFavoritePhotos();
  const manual = Array.isArray(db.homeFavoritePhotoIds);

  $('#homeFavoritesSummary').textContent = all.length || manual
    ? `${items.length} / ${homeFavoriteLimit}枚を表示${
        manual ? '（自分で選択）' : ''
      } / お気に入り${all.length}件`
    : '';

  $('#homeFavorites').innerHTML = items.map((item) => `
    <button
      type="button"
      class="home-favorite"
      data-open-favorite="${escapeHtml(item.id)}"
      aria-label="${escapeHtml(favoritePhotoLabel(item))}を開く"
    >
      <span
        class="photo-image"
        data-favorite-image="${escapeHtml(item.imageId || item.id)}"
      >
        <span>画像なし</span>
      </span>

      <strong>${escapeHtml(item.member)}</strong>
      <span>${escapeHtml(item.series)}</span>

      <small>
        ${escapeHtml(item.pose || '')} ·
        ${escapeHtml({
          collection: 'コレクション',
          offer: '提供用',
          want: '希望'
        }[item.inventory] || '')}
      </small>
    </button>
  `).join('') || empty(
    manual
      ? '「表示する写真を編集」から、ホームに表示する写真を選べます。'
      : '生写真で「☆ お気に入り」を選ぶと、ここに表示されます。'
  );

  loadFavoriteImages($('#homeFavorites'));
}

function initHomeFavoriteEditor() {
  if ($('#homeFavoriteModal')) return;

  const header = $('#homeFavorites')
    .closest('.panel')
    .querySelector('.panel-head');

  const actions = document.createElement('div');
  actions.className = 'photo-actions';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'subtle';
  button.id = 'editHomeFavorites';
  button.textContent = '表示する写真を編集';
  button.onclick = openHomeFavoriteEditor;

  actions.append(button);

  const link = header.querySelector('[data-go="photos"]');

  if (link) {
    actions.append(link);
  }

  header.append(actions);

  const modal = document.createElement('div');
  modal.id = 'homeFavoriteModal';
  modal.className = 'modal-wrap';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'homeFavoriteEditorTitle');

  modal.innerHTML = `
    <div class="modal">
      <h3 id="homeFavoriteEditorTitle">ホームに表示する写真</h3>

      <p class="field-hint">
        お気に入りから最大6枚を選べます。
        上から順に、ホームでは左から右へ表示します。
      </p>

      <p id="homeFavoriteSelectedCount" aria-live="polite"></p>
      <div id="homeFavoriteSelected"></div>

      <div class="field">
        <label for="homeFavoriteSearch">お気に入りから探す</label>
        <input
          type="search"
          id="homeFavoriteSearch"
          placeholder="メンバー・シリーズ・ポーズを検索"
        >
      </div>

      <p
        id="homeFavoriteCandidateCount"
        class="field-hint"
        aria-live="polite"
      ></p>

      <div
        id="homeFavoriteCandidates"
        style="max-height: 320px; overflow-y: auto"
      ></div>

      <button
        type="button"
        class="subtle"
        id="homeFavoriteMore"
        hidden
      >さらに表示</button>

      <div class="modal-actions">
        <button
          type="button"
          class="secondary"
          id="cancelHomeFavorites"
        >キャンセル</button>

        <button
          type="button"
          class="primary"
          id="saveHomeFavorites"
        >保存する</button>
      </div>
    </div>
  `;

  document.body.append(modal);

  $('#cancelHomeFavorites').onclick = closeHomeFavoriteEditor;
  $('#saveHomeFavorites').onclick = saveHomeFavoriteSelection;

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeHomeFavoriteEditor();
    }

    const move = event.target.closest('[data-home-favorite-move]');
    const remove = event.target.closest('[data-home-favorite-remove]');

    if (move) {
      const index = Number(move.dataset.homeFavoriteMove);
      const next = index + Number(move.dataset.direction);
      const ids = homeFavoriteEditorState.ids;

      if (next < 0 || next >= ids.length) return;

      [ids[index], ids[next]] = [ids[next], ids[index]];

      renderHomeFavoriteSelection();

      $('#homeFavoriteSelected')
        .querySelectorAll('[data-home-selected-row]')[next]
        ?.querySelector('[data-home-favorite-remove]')
        ?.focus({ preventScroll: true });
    } else if (remove) {
      homeFavoriteEditorState.ids.splice(
        Number(remove.dataset.homeFavoriteRemove),
        1
      );

      renderHomeFavoriteSelection();
      renderHomeFavoriteCandidates();

      $('#homeFavoriteSearch').focus({ preventScroll: true });
    }
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeHomeFavoriteEditor();
    }

    if (event.key !== 'Tab') return;

    const controls = [
      ...modal.querySelectorAll('button, input')
    ].filter(
      (element) =>
        !element.disabled &&
        element.getClientRects().length
    );

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

  $('#homeFavoriteSearch').addEventListener('input', (event) => {
    homeFavoriteEditorState.query = event.target.value;
    homeFavoriteEditorState.shown = 40;

    renderHomeFavoriteCandidates();
  });

  $('#homeFavoriteMore').onclick = () => {
    homeFavoriteEditorState.shown += 40;
    renderHomeFavoriteCandidates();
  };

  $('#homeFavoriteCandidates').addEventListener('change', (event) => {
    const input = event.target.closest('[data-home-favorite-choice]');

    if (!input) return;

    const id = input.dataset.homeFavoriteChoice;
    const ids = homeFavoriteEditorState.ids;

    if (input.checked) {
      if (ids.length >= homeFavoriteLimit) {
        input.checked = false;
        toast('選べるのは6枚までです');
        return;
      }

      if (!ids.includes(id)) {
        ids.push(id);
      }
    } else {
      homeFavoriteEditorState.ids = ids.filter(
        (value) => value !== id
      );
    }

    renderHomeFavoriteSelection();

    modal.querySelectorAll('[data-home-favorite-choice]').forEach(
      (choice) => {
        choice.checked = homeFavoriteEditorState.ids.includes(
          choice.dataset.homeFavoriteChoice
        );
      }
    );
  });
}

function openHomeFavoriteEditor() {
  homeFavoriteEditorState.ids = homeFavoritePhotos().map(
    (item) => String(item.id)
  );

  homeFavoriteEditorState.query = '';
  homeFavoriteEditorState.shown = 40;

  $('#homeFavoriteSearch').value = '';

  renderHomeFavoriteSelection();
  renderHomeFavoriteCandidates();

  $('#homeFavoriteModal').classList.add('open');
  $('#homeFavoriteSearch').focus({ preventScroll: true });
}

function closeHomeFavoriteEditor() {
  $('#homeFavoriteModal').classList.remove('open');
  $('#editHomeFavorites')?.focus({ preventScroll: true });
}

function renderHomeFavoriteSelection() {
  const records = new Map(
    favoritePhotos().map((item) => [String(item.id), item])
  );

  const ids = homeFavoriteEditorState.ids;

  $('#homeFavoriteSelectedCount').textContent =
    `選択中 ${ids.length} / ${homeFavoriteLimit}枚`;

  $('#homeFavoriteSelected').innerHTML = ids.map((id, index) => {
    const item = records.get(id);

    if (!item) return '';

    return `
      <div
        class="data-row"
        data-home-selected-row
        style="flex-wrap: wrap; gap: 10px"
      >
        <span
          class="photo-image"
          data-favorite-image="${escapeHtml(item.imageId || item.id)}"
          style="width: 54px; flex: 0 0 54px"
        >
          <span>画像なし</span>
        </span>

        <div
          class="data-main"
          style="min-width: 0; overflow-wrap: anywhere"
        >
          <strong>${index + 1}. ${escapeHtml(item.member)}</strong>
          <small>
            ${escapeHtml(
              [item.series, item.pose].filter(Boolean).join(' / ')
            )}
          </small>
        </div>

        <div class="photo-actions">
          <button
            type="button"
            class="subtle"
            data-home-favorite-move="${index}"
            data-direction="-1"
            aria-label="${index + 1}番の写真を前へ"
            style="min-width: 44px; min-height: 44px"
            ${index === 0 ? 'disabled' : ''}
          >↑</button>

          <button
            type="button"
            class="subtle"
            data-home-favorite-move="${index}"
            data-direction="1"
            aria-label="${index + 1}番の写真を後ろへ"
            style="min-width: 44px; min-height: 44px"
            ${index === ids.length - 1 ? 'disabled' : ''}
          >↓</button>

          <button
            type="button"
            class="subtle"
            data-home-favorite-remove="${index}"
            aria-label="${index + 1}番の写真を表示枠から外す"
            style="min-height: 44px"
          >外す</button>
        </div>
      </div>
    `;
  }).join('') || `
    <p class="field-hint">
      下のお気に入りから写真を選んでください。
    </p>
  `;

  loadFavoriteImages($('#homeFavoriteSelected'));
}

function renderHomeFavoriteCandidates() {
  const state = homeFavoriteEditorState;
  const terms = normalize(state.query).split(/\s+/).filter(Boolean);
  const all = favoritePhotos();

  const matches = all.filter((item) => {
    const kana = members.find(
      (member) => member.name === item.member
    )?.kana || '';

    const text = normalize(
      [item.member, kana, item.series, item.pose, item.note]
        .filter(Boolean)
        .join(' ')
    );

    return terms.every((term) => text.includes(term));
  });

  const visible = matches.slice(0, state.shown);

  $('#homeFavoriteCandidateCount').textContent =
    `${visible.length} / ${matches.length}件を表示`;

  $('#homeFavoriteMore').hidden =
    visible.length >= matches.length;

  $('#homeFavoriteCandidates').innerHTML = visible.map((item) => `
    <label
      class="data-row"
      style="gap: 10px; cursor: pointer; min-height: 64px"
    >
      <input
        type="checkbox"
        data-home-favorite-choice="${escapeHtml(item.id)}"
        aria-label="${escapeHtml(favoritePhotoLabel(item))}をホームに表示"
        ${state.ids.includes(String(item.id)) ? 'checked' : ''}
      >

      <span
        class="photo-image"
        data-favorite-image="${escapeHtml(item.imageId || item.id)}"
        style="width: 42px; flex: 0 0 42px"
      >
        <span>画像なし</span>
      </span>

      <span
        class="data-main"
        style="min-width: 0; overflow-wrap: anywhere"
      >
        <strong>${escapeHtml(item.member)}</strong>
        <small>
          ${escapeHtml(
            [item.series, item.pose].filter(Boolean).join(' / ')
          )}
        </small>
      </span>
    </label>
  `).join('') || empty(
    all.length
      ? '条件に合うお気に入りはありません'
      : '先に生写真をお気に入りに登録してください'
  );

  loadFavoriteImages($('#homeFavoriteCandidates'));
}

function saveHomeFavoriteSelection() {
  const valid = new Set(
    favoritePhotos().map((item) => String(item.id))
  );

  const next = [...new Set(homeFavoriteEditorState.ids)]
    .filter((id) => valid.has(id));

  if (next.length > homeFavoriteLimit) {
    toast('選べるのは6枚までです');
    return;
  }

  const hadPrevious = Object.prototype.hasOwnProperty.call(
    db,
    'homeFavoritePhotoIds'
  );

  const previous = db.homeFavoritePhotoIds;

  db.homeFavoritePhotoIds = next;

  try {
    save();
  } catch (error) {
    if (hadPrevious) {
      db.homeFavoritePhotoIds = previous;
    } else {
      delete db.homeFavoritePhotoIds;
    }

    console.error('ホームの写真を保存できませんでした', error);
    toast('ホームの写真を保存できませんでした');
    return;
  }

  renderHomeFavorites();
  closeHomeFavoriteEditor();

  toast('ホームに表示する写真を保存しました');
}

function openFavoritePhoto(id) {
  const item = db.photos.find(
    (photo) => String(photo.id) === String(id)
  );

  if (!item) return;

  $('#photoFavoritesOnly').checked = false;
  photoBrowserState.status = '';

  setPhotoView(
    item.inventory === 'collection' ? 'owned' : item.inventory
  );

  openPhotoCatalogRecord(item);
  go('photos');

  const card = [
    ...document.querySelectorAll('[data-photo-record]')
  ].find(
    (element) => element.dataset.photoRecord === String(id)
  );

  if (card) {
    card.focus({ preventScroll: true });

    card.scrollIntoView({
      block: 'center',
      behavior: 'smooth'
    });
  }
}
