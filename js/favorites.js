'use strict';

function togglePhotoFavorite(id) {
  const item = db.photos.find(photo => String(photo.id) === String(id));
  if (!item) return;
  const previous = item.favorite, previousAt = item.favoriteAt;
  item.favorite = !item.favorite;
  item.favoriteAt = item.favorite ? Date.now() : undefined;
  try { save(); } catch {
    item.favorite = previous; item.favoriteAt = previousAt;
    toast('お気に入りを保存できませんでした'); return;
  }
  render();
  const card = [...document.querySelectorAll('[data-photo-record]')].find(element => element.dataset.photoRecord === String(id));
  (card?.querySelector('[data-favorite-photo]') || $('#photoFavoritesOnly')).focus({preventScroll:true});
  toast(item.favorite ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
}

function renderHomeFavorites() {
  const all = db.photos.filter(item => item.favorite).sort((a,b) => (b.favoriteAt || 0) - (a.favoriteAt || 0));
  const items = all.slice(0,6);
  $('#homeFavoritesSummary').textContent = all.length ? `${items.length}件を表示 / お気に入り${all.length}件` : '';
  $('#homeFavorites').innerHTML = items.map(item => `<button type="button" class="home-favorite" data-open-favorite="${escapeHtml(item.id)}" aria-label="${escapeHtml([item.member,item.series,item.pose].filter(Boolean).join(' '))}を開く"><span class="photo-image" data-favorite-image="${escapeHtml(item.imageId || item.id)}"><span>画像なし</span></span><strong>${escapeHtml(item.member)}</strong><span>${escapeHtml(item.series)}</span><small>${escapeHtml(item.pose || '')} · ${escapeHtml({collection:'コレクション',offer:'提供用',want:'希望'}[item.inventory] || '')}</small></button>`).join('') || '<p class="empty">生写真で「☆ お気に入り」を選ぶと、ここに表示されます。</p>';
  $('#homeFavorites').querySelectorAll('[data-favorite-image]').forEach(async element => {
    try {
      const url = await getPhotoURL(element.dataset.favoriteImage);
      if (url && element.isConnected) { const image = new Image(); image.src = url; image.alt = 'お気に入りの生写真'; element.replaceChildren(image); }
    } catch { if (element.isConnected) element.textContent = '画像を読み込めませんでした'; }
  });
}

function openFavoritePhoto(id) {
  const item = db.photos.find(photo => String(photo.id) === String(id));
  if (!item) return;
  $('#photoFavoritesOnly').checked = false;
  setPhotoView(item.inventory === 'collection' ? 'owned' : item.inventory);
  go('photos');
  const card = [...document.querySelectorAll('[data-photo-record]')].find(element => element.dataset.photoRecord === String(id));
  if (card) { card.focus({preventScroll:true}); card.scrollIntoView({block:'center',behavior:'smooth'}); }
}
