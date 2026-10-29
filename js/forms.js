import { forms } from '../data/features.js';
import { db, save } from './storage.js';
import { $, escapeHtml, render, toast, photoCount } from './ui.js';
import { savePhoto } from './photoStorage.js';
import {
  attachMemberAutocomplete,
  isMember,
} from './memberAutocomplete.js';

function openForm(collection, existing) {
  const config = forms[collection];
  if (!config) return;

  $('#modalTitle').textContent = config.title;

  const box = $('#formFields');
  box.innerHTML = '';

  config.fields.forEach(([name, label, kind, required, options]) => {
    const wrap = document.createElement('div');
    wrap.className = 'field' + (kind === 'textarea' ? ' full' : '');

    let input;

    if (kind === 'select') {
      input = document.createElement('select');

      options.forEach((value) => {
        const option = document.createElement('option');
        option.textContent = value;
        input.append(option);
      });
    } else if (kind === 'member') {
      input = document.createElement('input');
      input.type = 'text';
    } else if (kind === 'textarea') {
      input = document.createElement('textarea');
    } else {
      input = document.createElement('input');
      input.type = kind;
    }

    if (kind === 'file') {
      input.accept = 'image/*';
    }

    input.id = `field-${name}`;
    input.name = name;
    if (collection === 'photos' && name === 'count') { input.min = '0'; input.max = '99999'; input.step = '1'; input.value = existing ? photoCount(existing) : 1; }
    input.required = required;

    if (kind === 'date') {
      input.value = new Date().toISOString().slice(0, 10);
    }

    wrap.innerHTML = `<label for="field-${name}">${escapeHtml(label)}${required ? ' *' : ''}</label>`;
    if (existing && kind !== 'file' && name !== 'count') input.value = existing[name] || '';
    wrap.append(input);
    box.append(wrap);

    if (kind === 'member') {
      attachMemberAutocomplete(input);
    }
  });

  if (existing) $('#modalTitle').textContent = '生写真を編集（画像未選択なら現在の画像を保持）';
  $('#modalWrap').classList.add('open');
}

export function initForms() {
  let activeCollection = '';
  let editingItem = null;
  let submitting = false;

  document.body.addEventListener('click', (event) => {
    if (submitting) return;
    const edit = event.target.closest('[data-edit-photo]');
    if (edit) { activeCollection = 'photos'; editingItem = db.photos[Number(edit.dataset.editPhoto)]; openForm('photos', editingItem); return; }
    const button = event.target.closest('[data-add]');
    if (!button) return;

    editingItem = null;
    activeCollection = button.dataset.add;
    openForm(activeCollection);
  });

  $('#cancelBtn').onclick = () => {
    if (submitting) return;
    $('#modalWrap').classList.remove('open');
  };

  $('#modalWrap').onclick = (event) => {
    if (!submitting && event.target.id === 'modalWrap') {
      $('#modalWrap').classList.remove('open');
    }
  };

  $('#itemForm').onsubmit = async (event) => {
    event.preventDefault();

    if (!activeCollection) return;

    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const item = Object.fromEntries(data.entries());
    const photo = item.photo;

    delete item.photo;
    item.id = editingItem?.id ?? crypto.randomUUID();
    if (activeCollection === 'photos') {
      item.count = Number(item.count);
      if (!Number.isSafeInteger(item.count) || item.count < 0 || item.count > 99999) { toast('所持枚数は0〜99999の整数で入力してください'); return; }
      item.status = item.count > 0 ? '所持' : '未所持';
      item.series = item.series.trim();
      if (!item.series) { toast('シリーズを入力してください'); return; }
      if (photo instanceof File && photo.size && !photo.type.startsWith('image/')) { toast('画像ファイルを選んでください'); return; }
    }

    if (
      ['photos', 'reports'].includes(activeCollection) &&
      !isMember(item.member)
    ) {
      toast('候補からメンバーを選んでください');
      event.currentTarget.querySelector('[name="member"]')?.focus();
      return;
    }

    submitting = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (activeCollection === 'photos' && photo instanceof File && photo.size > 0) await savePhoto(item.id, photo);
      if (editingItem) db[activeCollection].splice(db[activeCollection].indexOf(editingItem), 1, item);
      else db[activeCollection].unshift(item);
      try { save(); } catch (error) {
        if (editingItem) db[activeCollection].splice(db[activeCollection].indexOf(item), 1, editingItem);
        else db[activeCollection].shift();
        throw error;
      }
      render();
      $('#modalWrap').classList.remove('open');
      form.reset();
      toast('保存しました');
    } catch {
      toast('保存できませんでした。空き容量と画像を確認してください');
    } finally {
      submitting = false;
      submit.disabled = false;
    }
  };
}
