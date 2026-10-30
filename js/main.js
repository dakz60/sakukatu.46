'use strict';

initForms();
initTrades();
initAppearance();

$('#nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) {
    go(button.dataset.page, render);
  }
});

document.body.addEventListener('click', (event) => {
  const target = event.target.closest('[data-go]');
  if (target) {
    go(target.dataset.go, render);
  }

  const view = event.target.closest('[data-photo-view]');
  if (view) setPhotoView(view.dataset.photoView);
  const counter = event.target.closest('[data-count]');
  if (counter) {
    const item = db.photos[Number(counter.dataset.count)];
    const previous = photoCount(item);
    const previousStatus = item.status;
    item.count = Math.min(99999, Math.max(0, previous + Number(counter.dataset.delta)));
    item.status = item.count > 0 ? '所持' : '未所持';
    try { save(); render(); } catch { item.count = previous; item.status = previousStatus; toast('保存できませんでした。空き容量を確認してください'); }
  }
  const remove = event.target.closest('[data-delete]');
  if (remove) {
    const collection = remove.dataset.delete;
    if (!confirm('この記録を削除しますか？')) return;
    const index = Number(remove.dataset.index);
    const [deleted] = db[collection].splice(index, 1);
    try { save(); } catch { db[collection].splice(index, 0, deleted); toast('削除を保存できませんでした'); return; }
    if (collection === 'reports' && deleted) reportImageIds(deleted).forEach(id => deletePhoto(id).catch(() => {}));
    if (['photos', 'milestones'].includes(collection) && deleted && !imageInUse(deleted.imageId || deleted.id)) deletePhoto(deleted.imageId || deleted.id).catch(() => {});
    render();
    toast('削除しました');
  }
});

$('#menuBtn').onclick = () => {
  $('#sidebar').classList.toggle('open');
};

$('#todayBtn').onclick = () => {
  go('home', render);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.body.addEventListener('change', (event) => {
  if (event.target.matches('[data-done]')) {
    const item = db.todos.find(
      (todo) => String(todo.id) === event.target.dataset.done
    );

    if (item) {
      item.done = event.target.checked;
    }

    save();
    render();
    toast('ToDoを完了にしました');
  }

  if (event.target.matches('[data-filter], [data-photo-filter]')) {
    render();
  }
});

document.body.addEventListener('input', (event) => {
  if (event.target.matches('[data-search]')) {
    render();
  }
});

const profileModal = $('#profileModal');
const profileMembers = $('#profileMembers');

$('#editProfile').onclick = () => {
  const selected = new Set(db.profile.members || (members.some(member => member.name === db.profile.name) ? [db.profile.name] : []));
  profileMembers.replaceChildren();
  const legend = document.createElement('legend');
  legend.textContent = '推しメンを選択';
  profileMembers.append(legend);
  members.forEach(member => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.name = 'members'; input.value = member.name;
    input.checked = selected.has(member.name);
    label.append(input, document.createTextNode(`${member.name}（${member.birthday.slice(5).replace('-', '/')}）`));
    const row = document.createElement('div'); row.className = 'favorite-row';
    const dateLabel = document.createElement('label'); dateLabel.className = 'favorite-date';
    dateLabel.append(document.createTextNode('推し始めた日'));
    const since = document.createElement('input'); since.type = 'date'; since.dataset.favoriteSince = member.name;
    since.setAttribute('aria-label', `${member.name}を推し始めた日`);
    const today = new Date(); since.max = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0,10);
    since.value = db.profile.startDates?.[member.name] || '';
    const update = () => { dateLabel.hidden = !input.checked; since.disabled = !input.checked; };
    input.addEventListener('change', update); update(); dateLabel.append(since);
    row.append(label, dateLabel); profileMembers.append(row);
  });
  profileModal.classList.add('open');
  profileMembers.querySelector('input')?.focus();
};

$('#profileCancel').onclick = () => {
  profileModal.classList.remove('open');
};

profileModal.onclick = (event) => {
  if (event.target === profileModal) {
    profileModal.classList.remove('open');
  }
};

$('#profileForm').onsubmit = (event) => {
  event.preventDefault();

  const selected = [...profileMembers.querySelectorAll('input:checked')].map(input => input.value);
  const startDates = { ...db.profile.startDates };
  for (const field of profileMembers.querySelectorAll('[data-favorite-since]:not(:disabled)')) {
    if (field.value && supportingDays(field.value) == null) { toast('推し始めた日は今日以前の日付を指定してください'); return; }
    if (field.value) startDates[field.dataset.favoriteSince] = field.value; else delete startDates[field.dataset.favoriteSince];
  }
  const previous = db.profile;
  const first = members.find(member => member.name === selected[0]);
  db.profile = { ...db.profile, members: selected, startDates, name: first?.name || '推しメンバー', birthday: first?.birthday || '', group: '櫻坂46' };
  try { save(); } catch { db.profile = previous; toast('保存できませんでした'); return; }
  render();
  profileModal.classList.remove('open');
  toast('推しメンを保存しました');
};

go('home');
