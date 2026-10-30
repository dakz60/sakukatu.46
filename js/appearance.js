import { db, save } from './storage.js?v=20261030-11';
import { savePhoto, getPhotoURL, deletePhoto } from './photoStorage.js?v=20261030-11';
import { $, toast } from './ui.js?v=20261030-11';

export function initAppearance() {
  const modal = $('#appearanceModal'), form = $('#appearanceForm');
  const fileInput = $('#backgroundFile'), wash = $('#backgroundWash');
  const preview = $('#backgroundPreview');
  let temporaryURL = '', busy = false, generation = 0;
  const setPreview = url => { preview.style.backgroundImage = url ? `url("${url}")` : 'none'; preview.classList.toggle('has-image', !!url); };
  const updateWash = () => { $('#backgroundWashValue').textContent = `${wash.value}%`; preview.style.setProperty('--preview-wash', Number(wash.value) / 100); };
  function releasePreview() { if (temporaryURL) URL.revokeObjectURL(temporaryURL); temporaryURL = ''; }
  async function apply() {
    const current = ++generation;
    const settings = db.appearance || {};
    document.body.style.setProperty('--background-wash', (settings.wash ?? 80) / 100);
    if (!settings.backgroundId) { document.body.style.removeProperty('--user-background'); document.body.classList.remove('has-custom-background'); return; }
    try {
      const url = await getPhotoURL(settings.backgroundId);
      if (current !== generation) return;
      if (!url) throw new Error();
      document.body.style.setProperty('--user-background', `url("${url}")`); document.body.classList.add('has-custom-background');
    } catch { toast('背景画像を読み込めませんでした。背景の設定から選び直せます'); }
  }
  $('#appearanceBtn').onclick = async () => {
    form.reset(); releasePreview(); setPreview(''); wash.value = db.appearance?.wash ?? 80; updateWash();
    $('#removeBackground').disabled = !db.appearance?.backgroundId;
    modal.classList.add('open');
    if (db.appearance?.backgroundId) {
      try { const url = await getPhotoURL(db.appearance.backgroundId); if (modal.classList.contains('open') && !fileInput.files.length) setPreview(url); } catch { toast('背景画像を読み込めませんでした'); }
    }
  };
  const close = () => { if (!busy) { modal.classList.remove('open'); releasePreview(); } };
  $('#cancelAppearance').onclick = close; modal.onclick = event => { if (event.target === modal) close(); };
  fileInput.onchange = () => {
    releasePreview(); const file = fileInput.files[0];
    if (file && !file.type.startsWith('image/')) { fileInput.value = ''; toast('画像ファイルを選んでください'); return; }
    if (file) { temporaryURL = URL.createObjectURL(file); setPreview(temporaryURL); }
  };
  wash.oninput = updateWash;
  const setBusy = value => { busy = value; form.querySelectorAll('button,input').forEach(element => { element.disabled = value; }); if (!value) $('#removeBackground').disabled = !db.appearance?.backgroundId; };
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const file = fileInput.files[0], previous = db.appearance;
    if (!file && !previous?.backgroundId) { toast('背景にする画像を選んでください'); return; }
    let newId;
    setBusy(true);
    try {
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error();
        const image = new Image(); image.src = temporaryURL; await image.decode();
        newId = `background-${crypto.randomUUID()}`; await savePhoto(newId, file);
      }
      db.appearance = {backgroundId: newId || previous.backgroundId, wash: Number(wash.value)};
      try { save(); } catch (error) { db.appearance = previous; throw error; }
      await apply(); modal.classList.remove('open'); releasePreview();
      if (newId && previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {});
      toast('背景を保存しました');
    } catch { if (newId) deletePhoto(newId).catch(() => {}); toast('背景を保存できませんでした。画像と空き容量を確認してください'); }
    finally { setBusy(false); }
  };
  $('#removeBackground').onclick = async () => {
    if (busy) return;
    const previous = db.appearance; db.appearance = {wash:previous?.wash ?? 80};
    try { save(); } catch { db.appearance = previous; toast('背景の解除を保存できませんでした'); return; }
    setBusy(true); await apply(); modal.classList.remove('open'); releasePreview();
    if (previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {});
    setBusy(false); toast('背景を解除しました');
  };
  apply();
}
