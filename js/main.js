import { db, save } from './storage.js';
import { $, go, render, toast } from './ui.js';
import { initForms } from './forms.js';
import { deletePhoto } from './photoStorage.js';

initForms();

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

  const remove = event.target.closest('[data-delete]');
  if (remove) {
    const collection = remove.dataset.delete;
    const [deleted] = db[collection].splice(Number(remove.dataset.index), 1);

    if (collection === 'photos' && deleted) {
      deletePhoto(deleted.id).catch(() => {});
    }

    save();
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
      (todo) => todo.id === Number(event.target.dataset.done)
    );

    if (item) {
      item.done = true;
    }

    save();
    render();
    toast('ToDoを完了にしました');
  }

  if (event.target.matches('[data-filter]')) {
    render();
  }
});

document.body.addEventListener('input', (event) => {
  if (event.target.matches('[data-search]')) {
    render();
  }
});

$('#editProfile').onclick = () => {
  const name = prompt('櫻坂46の推しメンバー', db.profile.name);
  if (name === null) return;

  const birthday = prompt(
    '誕生日（任意・YYYY-MM-DD）',
    db.profile.birthday || ''
  );
  if (birthday === null) return;

  const anniversary = prompt(
    '記念日（任意・YYYY-MM-DD）',
    db.profile.anniversary || ''
  );
  if (anniversary === null) return;

  db.profile = {
    name,
    group: '櫻坂46',
    birthday,
    anniversary,
  };

  save();
  render();
  toast('プロフィールを保存しました');
};

render();
