import { forms, members } from '../data/features.js?v=20261030-4';
import { db, save } from './storage.js?v=20261030-4';
import { $, render, toast } from './ui.js?v=20261030-4';
import { photoCount, offerCount, wantCount } from './collectionModel.js?v=20261030-4';
import { savePhoto, deletePhoto } from './photoStorage.js?v=20261030-4';
import { attachMemberAutocomplete, isMember } from './memberAutocomplete.js?v=20261030-4';

import { createReportEditor, prepareReport, reportImageIds } from './reports.js?v=20261030-4';

export function initForms() {
  let collection = '', editing = null, busy = false, conversation = [];
  function open(name, item = null, defaults = {}) {
    if (!forms[name]) return;
    collection = name; editing = item;
    const values = item || defaults;
    $('#modalTitle').textContent = item ? `${name === 'photos' ? '生写真' : name === 'reports' ? 'ミーグリレポ' : '記念日'}を編集` : forms[name].title;
    const box = $('#formFields'); box.replaceChildren();
    for (const [key, label, kind, required, choices] of forms[name].fields) {
      const wrap = document.createElement('div'); wrap.className = 'field' + (['textarea', 'members'].includes(kind) ? ' full' : '');
      if (kind === 'members') {
        const fieldset = document.createElement('fieldset'); fieldset.className = 'member-checkboxes';
        const legend = document.createElement('legend'); legend.textContent = label; fieldset.append(legend);
        for (const member of members) {
          const row = document.createElement('label'), input = document.createElement('input');
          input.type = 'checkbox'; input.name = key; input.value = member.name; input.checked = (values.members || []).includes(member.name);
          row.append(input, document.createTextNode(member.name)); fieldset.append(row);
        }
        wrap.append(fieldset); box.append(wrap); continue;
      }
      const input = document.createElement(kind === 'select' ? 'select' : kind === 'textarea' ? 'textarea' : 'input');
      if (kind === 'select') for (const choice of choices) { const option = document.createElement('option'); option.textContent = choice; input.append(option); }
      else if (kind !== 'textarea') input.type = kind === 'member' ? 'text' : kind;
      input.id = `field-${key}`; input.name = key; input.required = required;
      if (kind === 'file') input.accept = 'image/*';
      else if (kind === 'date') { const date = new Date(); input.value = values[key] || new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
      else input.value = values[key] ?? (kind === 'select' ? choices[0] : '');
      if (name === 'reports' && key === 'tickets') { input.min = '1'; input.max = '9999'; input.step = '1'; }
      if (name === 'photos' && ['count', 'offer', 'want'].includes(key)) {
        input.min = '0'; input.max = '99999'; input.step = '1';
        input.value = key === 'count' ? (item ? photoCount(item) : defaults.count ?? 1) : key === 'offer' ? offerCount(values) : wantCount(values);
      }
      const caption = document.createElement('label'); caption.htmlFor = input.id; caption.textContent = label + (required ? ' *' : '');
      wrap.append(caption, input);
      if (key === 'photo' && item) { const hint = document.createElement('small'); hint.textContent = '画像を選ばなければ現在の画像を保持します'; wrap.append(hint); }
      if (name === 'photos' && key === 'pose') {
        const custom = document.createElement('input');
        custom.type = 'text'; custom.name = 'customPose'; custom.id = 'field-customPose'; custom.placeholder = '例外のポーズ・種類を入力';
        const customLabel = document.createElement('label'); customLabel.htmlFor = custom.id; customLabel.textContent = 'その他のポーズ・種類 *';
        const known = choices.slice(0, -1);
        if (values.pose && !known.includes(values.pose)) { input.value = 'その他'; custom.value = values.pose; }
        const updateCustom = () => { const show = input.value === 'その他'; custom.hidden = customLabel.hidden = !show; custom.disabled = !show; custom.required = show; };
        input.addEventListener('change', updateCustom); updateCustom(); wrap.append(customLabel, custom);
      }
      box.append(wrap);
      if (kind === 'member') attachMemberAutocomplete(input);
    }
    conversation = name === 'reports' ? createReportEditor(box, values) : [];
    $('#modalWrap').classList.add('open');
  }
  document.body.addEventListener('click', event => {
    if (busy) return;
    const edit = event.target.closest('[data-edit-photo], [data-edit-milestone], [data-edit-report]');
    if (edit) { const name = edit.hasAttribute('data-edit-photo') ? 'photos' : edit.hasAttribute('data-edit-report') ? 'reports' : 'milestones'; open(name, db[name][Number(name === 'photos' ? edit.dataset.editPhoto : name === 'reports' ? edit.dataset.editReport : edit.dataset.editMilestone)]); return; }
    const source = event.target.closest('[data-create-milestone]');
    if (source) {
      const record = db[source.dataset.createMilestone][Number(source.dataset.index)];
      const linked = db.milestones.find(item => item.sourceId === String(record.id) && item.sourceCollection === source.dataset.createMilestone);
      if (linked) { open('milestones', linked); return; }
      open('milestones', null, { title: record.title || '初ミーグリ', date: record.date, note: [record.note, ...(record.messages || []).map(message => message.kind === 'image' ? '（画像）' : `${message.kind === 'member' ? record.member : message.kind === 'self' ? '自分' : 'メモ'}：${message.text}`)].filter(Boolean).join('\n'), members: record.member ? [record.member] : [], sourceId: String(record.id), sourceCollection: source.dataset.createMilestone });
      // Keep the source association with the form, without copying source records.
      $('#itemForm').dataset.sourceId = String(record.id); $('#itemForm').dataset.sourceCollection = source.dataset.createMilestone;
      return;
    }
    const add = event.target.closest('[data-add]');
    if (add) { delete $('#itemForm').dataset.sourceId; delete $('#itemForm').dataset.sourceCollection; open(add.dataset.add, null, add.hasAttribute('data-wish') ? { count: 0, want: 1 } : {}); }
  });
  const close = () => { if (!busy) $('#modalWrap').classList.remove('open'); };
  $('#cancelBtn').onclick = close;
  $('#modalWrap').onclick = event => { if (event.target.id === 'modalWrap') close(); };
  $('#itemForm').onsubmit = async event => {
    event.preventDefault(); if (busy || !collection) return;
    const form = event.currentTarget, data = new FormData(form);
    const item = { ...editing, ...Object.fromEntries(data.entries()), id: editing?.id ?? crypto.randomUUID() };
    const file = data.get('photo'); delete item.photo;
    if (['photos', 'reports'].includes(collection) && !isMember(item.member)) { toast('候補からメンバーを選んでください'); return; }
    if (collection === 'photos') {
      for (const key of ['count', 'offer', 'want']) item[key] = Number(item[key]);
      if (![item.count, item.offer, item.want].every(value => Number.isSafeInteger(value) && value >= 0 && value <= 99999)) { toast('枚数は0〜99999の整数で入力してください'); return; }
      if (item.offer > item.count) { toast('提供枚数は所持枚数以下にしてください'); return; }
      if (item.pose === 'その他') item.pose = (item.customPose || '').trim();
      delete item.customPose;
      if (!item.pose) { toast('ポーズ・種類を入力してください'); return; }
      item.series = item.series.trim(); if (!item.series) { toast('シリーズを入力してください'); return; }
      item.status = item.count ? '所持' : '未所持';
    }
    if (collection === 'milestones') {
      item.members = data.getAll('members');
      if (!item.members.length) { toast('メンバーを1人以上選んでください'); return; }
      item.title = item.title.trim(); if (!item.title) { toast('タイトルを入力してください'); return; }
      if (!editing && form.dataset.sourceId) { item.sourceId = form.dataset.sourceId; item.sourceCollection = form.dataset.sourceCollection; }
    }
    if (file instanceof File && file.size && !file.type.startsWith('image/')) { toast('画像ファイルを選んでください'); return; }
    busy = true; const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
    const previous = [...db[collection]];
    let newImage, persisted = false;
    const reportImages = [];
    try {
      if (collection === 'reports') await prepareReport(item, form, conversation, reportImages);
      if (file instanceof File && file.size) { newImage = `image-${crypto.randomUUID()}`; await savePhoto(newImage, file); item.imageId = newImage; }
      if (editing) db[collection].splice(db[collection].indexOf(editing), 1, item); else db[collection].unshift(item);
      try { save(); } catch (error) { db[collection] = previous; throw error; }
      persisted = true;
      if (collection === 'reports' && editing) reportImageIds(editing).filter(id => !reportImageIds(item).includes(id)).forEach(id => deletePhoto(id).catch(() => {}));
      if (newImage && editing) deletePhoto(editing.imageId || editing.id).catch(() => {});
      render(); $('#modalWrap').classList.remove('open'); form.reset(); toast('保存しました');
    } catch {
      if (!persisted) reportImages.forEach(id => deletePhoto(id).catch(() => {}));
      if (newImage && !persisted) deletePhoto(newImage).catch(() => {});
      toast('保存できませんでした。空き容量と画像を確認してください');
    } finally { busy = false; submit.disabled = false; }
  };
}
