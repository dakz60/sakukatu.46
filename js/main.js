import { db, save } from './storage.js';
import { $, go, render, toast } from './ui.js';
import { initForms } from './forms.js';
import { deletePhoto } from './photoStorage.js';
import { members } from '../data/features.js';
import {
  attachMemberAutocomplete,
  isMember,
} from './memberAutocomplete.js';

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
    const [deleted] = db[collection].splice(
      Number(remove.dataset.index),
      1
    );

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

const profileModal = $('#profileModal');
const profileMember = $('#profileMember');
const profileBirthday = $('#profileBirthday');

attachMemberAutocomplete(profileMember);

profileMember.addEventListener('change', () => {
  const member = members.find(
    (item) => item.name === profileMember.value
  );

  if (member) {
    profileBirthday.value = member.birthday;
  }
});

$('#editProfile').onclick = () => {
  profileMember.value = db.profile.name || '';
  profileBirthday.value = db.profile.birthday || '';
  profileModal.classList.add('open');
  profileMember.focus();
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

  const member = members.find(
    (item) => item.name === profileMember.value
  );

  if (!isMember(profileMember.value) || !member) {
    toast('候補からメンバーを選んでください');
    profileMember.focus();
    return;
  }

  db.profile = {
    ...db.profile,
    name: member.name,
    group: '櫻坂46',
    birthday: member.birthday,
  };

  save();
  render();
  profileModal.classList.remove('open');
  toast('プロフィールを保存しました');
};

render();
