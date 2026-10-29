import { forms } from '../data/features.js';
import { db, save } from './storage.js';
import { $, escapeHtml, render, toast } from './ui.js';
import { savePhoto } from './photoStorage.js';
import {
  attachMemberAutocomplete,
  isMember,
} from './memberAutocomplete.js';

function openForm(collection) {
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

    input.name = name;
    input.required = required;

    if (kind === 'date') {
      input.value = new Date().toISOString().slice(0, 10);
    }

    wrap.innerHTML = `<label>${escapeHtml(label)}${required ? ' *' : ''}</label>`;
    wrap.append(input);
    box.append(wrap);

    if (kind === 'member') {
      attachMemberAutocomplete(input);
    }
  });

  $('#modalWrap').classList.add('open');
}

export function initForms() {
  let activeCollection = '';

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add]');
    if (!button) return;

    activeCollection = button.dataset.add;
    openForm(activeCollection);
  });

  $('#cancelBtn').onclick = () => {
    $('#modalWrap').classList.remove('open');
  };

  $('#modalWrap').onclick = (event) => {
    if (event.target.id === 'modalWrap') {
      $('#modalWrap').classList.remove('open');
    }
  };

  $('#itemForm').onsubmit = async (event) => {
    event.preventDefault();

    if (!activeCollection) return;

    const data = new FormData(event.currentTarget);
    const item = Object.fromEntries(data.entries());
    const photo = item.photo;

    delete item.photo;
    item.id = Date.now();

    if (
      ['photos', 'reports'].includes(activeCollection) &&
      !isMember(item.member)
    ) {
      toast('候補からメンバーを選んでください');
      event.currentTarget.querySelector('[name="member"]')?.focus();
      return;
    }

    if (
      activeCollection === 'photos' &&
      photo instanceof File &&
      photo.size > 0
    ) {
      try {
        await savePhoto(item.id, photo);
      } catch {
        toast('画像を保存できませんでした');
        return;
      }
    }

    db[activeCollection].unshift(item);
    save();
    render();

    $('#modalWrap').classList.remove('open');
    event.currentTarget.reset();

    toast('保存しました');
  };
}
