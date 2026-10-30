import { escapeHtml } from './ui.js?v=20261030-7';
import { getPhotoURL, savePhoto } from './photoStorage.js?v=20261030-7';

export function reportImageIds(item) {
  return [item.memberAvatarId, item.selfAvatarId, ...(item.messages || []).map(message => message.imageId)].filter(Boolean);
}
export function createReportEditor(box, item) {
  const editor = document.createElement('div'); editor.className = 'field full conversation-editor';
  const heading = document.createElement('h4'); heading.textContent = '会話の順番';
  const hint = document.createElement('p'); hint.className = 'field-hint'; hint.textContent = '発言・動作メモ・画像を順番に追加できます。矢印で順番を変更できます。';
  const list = document.createElement('div'); list.className = 'conversation-lines';
  const toolbar = document.createElement('div'); toolbar.className = 'conversation-toolbar';
  const blocks = [];
  function update() { blocks.forEach((block, index) => { block.up.disabled = index === 0; block.down.disabled = index === blocks.length - 1; list.append(block.element); }); }
  function add(kind, value = {}) {
    const element = document.createElement('fieldset'); element.className = 'conversation-block';
    const legend = document.createElement('legend'); legend.textContent = {member:'メンバーの発言',self:'自分の発言',note:'動作・メモ',image:'途中の画像'}[kind];
    const input = document.createElement(kind === 'image' ? 'input' : 'textarea');
    input.setAttribute('aria-label', legend.textContent); input.dataset.messageInput = kind;
    if (kind === 'image') { input.type = 'file'; input.accept = 'image/*'; input.required = !value.imageId; }
    else { input.value = value.text || ''; input.rows = 2; input.placeholder = kind === 'note' ? '（用紙を出す）など' : '会話を入力'; }
    const actions = document.createElement('div'); actions.className = 'conversation-toolbar';
    const block = { kind, value, element, input };
    for (const [label, action] of [['↑',-1],['↓',1],['削除',0]]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label;
      button.setAttribute('aria-label', action === -1 ? 'この会話を上へ' : action === 1 ? 'この会話を下へ' : 'この会話を削除');
      if (action === -1) block.up = button; if (action === 1) block.down = button;
      button.onclick = () => { const index = blocks.indexOf(block); if (!action) { blocks.splice(index,1); element.remove(); } else { const target = index + action; if (target < 0 || target >= blocks.length) return; [blocks[index],blocks[target]] = [blocks[target],blocks[index]]; } update(); };
      actions.append(button);
    }
    element.append(legend, input);
    if (kind === 'image' && value.imageId) {
      const image = document.createElement('img'); image.className = 'editor-image'; image.alt = '現在の会話画像';
      getPhotoURL(value.imageId).then(url => { if (url) image.src = url; }).catch(() => {}); element.append(image);
    }
    element.append(actions); blocks.push(block); update();
  }
  for (const [kind, label] of [['member','＋ メンバー'],['self','＋ 自分'],['note','＋ 動作メモ'],['image','＋ 画像']]) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label; button.dataset.addMessage = kind; button.onclick = () => add(kind); toolbar.append(button);
  }
  editor.append(heading,hint,list,toolbar);box.append(editor);
  (item.messages || []).forEach(message => add(message.kind, message));
  return blocks;
}
export async function prepareReport(item, form, blocks, created) {
  item.messages = [];
  async function store(file) {
    if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください');
    const id = `image-${crypto.randomUUID()}`; created.push(id); await savePhoto(id,file); return id;
  }
  for (const name of ['memberAvatar','selfAvatar']) {
    const file = form.elements[name].files[0]; delete item[name];
    if (file) item[`${name}Id`] = await store(file);
  }
  for (const block of blocks) {
    if (block.kind === 'image') {
      const file = block.input.files[0];
      const imageId = file ? await store(file) : block.value.imageId;
      if (imageId) item.messages.push({kind:'image',imageId});
    } else if (block.input.value.trim()) item.messages.push({kind:block.kind,text:block.input.value.trim()});
  }
}
const avatar = (id, name, large = false) => `<span class="report-avatar ${large ? 'large' : ''}" ${id ? `data-report-image="${escapeHtml(id)}"` : ''}>${escapeHtml(name.slice(0,1))}</span>`;
export function reportCard(item,index) {
  const messages = (item.messages || []).map(message => {
    if (message.kind === 'image') return `<div class="report-inline-image" data-report-image="${escapeHtml(message.imageId)}"></div>`;
    if (message.kind === 'note') return `<p class="report-stage">${escapeHtml(message.text)}</p>`;
    const self = message.kind === 'self';
    return `<div class="report-message ${self ? 'from-self' : ''}">${avatar(self ? item.selfAvatarId : item.memberAvatarId,self ? '自分' : item.member)}<div class="report-bubble"><span class="sr-only">${self ? '自分' : escapeHtml(item.member)}：</span>${escapeHtml(message.text)}</div></div>`;
  }).join('');
  return `<article class="report-card"><header class="report-header">${avatar(item.memberAvatarId,item.member,true)}<h3>${escapeHtml(item.member)}</h3><time>${escapeHtml(item.date)}</time><div>${escapeHtml(item.part || '')}${item.tickets ? ` · ${escapeHtml(item.tickets)}枚` : ''}</div>${item.title ? `<p>${escapeHtml(item.title)}</p>` : ''}</header><div class="report-conversation">${messages}</div>${item.note ? `<div class="report-memo"><strong>${messages ? '感想・メモ' : 'レポ'}</strong><p>${escapeHtml(item.note)}</p></div>` : ''}<footer class="report-actions"><button class="subtle" data-edit-report="${index}">編集</button><button class="subtle" data-create-milestone="reports" data-index="${index}">記念日に追加</button><button class="del" data-delete="reports" data-index="${index}">削除</button></footer></article>`;
}
export function loadReportImages(container) {
  container.querySelectorAll('[data-report-image]').forEach(async element => {
    try { const url = await getPhotoURL(element.dataset.reportImage); if (url && element.isConnected) { const image = new Image(); image.src = url; image.alt = element.classList.contains('report-avatar') ? 'プロフィール画像' : '会話中の画像'; element.replaceChildren(image); } } catch { if (element.isConnected) element.textContent = '画像を読み込めませんでした'; }
  });
}
