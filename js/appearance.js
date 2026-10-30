'use strict';

function initAppearance() {
  const modal = $('#appearanceModal'), form = $('#appearanceForm');
  const fileInput = $('#backgroundFile'), shade = $('#backgroundShade'), cropButton = $('#cropBackground');
  const preview = $('#backgroundPreview');
  let temporaryURL = '', busy = false, generation = 0, previewRevision = 0;
  let pendingCrop = null, previewImage = null, backgroundImage = null;
  function updatePreviewCrop() {
    const ratio = window.innerWidth / window.innerHeight;
    const height = Math.min(200,form.clientWidth / ratio);
    Object.assign(preview.style,{width:`${height * ratio}px`,height:`${height}px`,minHeight:'0',marginLeft:'auto',marginRight:'auto'});
    if (previewImage) {
      const layout = imageCropLayout(previewImage.naturalWidth,previewImage.naturalHeight,preview.clientWidth,preview.clientHeight,pendingCrop);
      preview.style.backgroundSize = `${layout.width}px ${layout.height}px`; preview.style.backgroundPosition = `${layout.x}px ${layout.y}px`;
    }
  }
  function setPreview(url) {
    const revision = ++previewRevision;
    previewImage = null; preview.style.backgroundImage = url ? `url("${url}")` : 'none'; preview.classList.toggle('has-image',!!url); updatePreviewCrop();
    if (url) { const image = new Image(); image.onload = () => { if (revision === previewRevision) { previewImage = image; updatePreviewCrop(); } }; image.src = url; }
  }
  const updateShade = () => { $('#backgroundShadeValue').textContent = `${shade.value}%`; preview.style.setProperty('--preview-shade',Number(shade.value) / 100); };
  function releasePreview() { if (temporaryURL) URL.revokeObjectURL(temporaryURL); temporaryURL = ''; }
  function positionBackground() {
    if (!backgroundImage) return;
    const layout = imageCropLayout(backgroundImage.naturalWidth,backgroundImage.naturalHeight,window.innerWidth,window.innerHeight,db.appearance?.crop);
    document.body.style.setProperty('--user-background-size',`${layout.width}px ${layout.height}px`);
    document.body.style.setProperty('--user-background-position',`${layout.x}px ${layout.y}px`);
  }
  async function apply() {
    const current = ++generation, settings = db.appearance || {};
    document.body.style.setProperty('--background-shade',(settings.shade ?? 0) / 100);
    if (!settings.backgroundId) { backgroundImage = null; for (const key of ['--user-background','--user-background-size','--user-background-position']) document.body.style.removeProperty(key); document.body.classList.remove('has-custom-background'); return; }
    try {
      const url = await getPhotoURL(settings.backgroundId); if (!url) throw new Error();
      const image = new Image(); image.src = url; await image.decode();
      if (current !== generation) return;
      backgroundImage = image; positionBackground();
      document.body.style.setProperty('--user-background',`url("${url}")`); document.body.classList.add('has-custom-background');
    } catch { toast('背景画像を読み込めませんでした。背景の設定から選び直せます'); }
  }
  $('#appearanceBtn').onclick = async () => {
    form.reset(); releasePreview(); pendingCrop = db.appearance?.crop || null; shade.value = db.appearance?.shade ?? 0; updateShade();
    $('#removeBackground').disabled = cropButton.disabled = !db.appearance?.backgroundId;
    modal.classList.add('open'); setPreview('');
    if (db.appearance?.backgroundId) {
      try { const url = await getPhotoURL(db.appearance.backgroundId); if (modal.classList.contains('open') && !fileInput.files.length) setPreview(url); } catch { toast('背景画像を読み込めませんでした'); }
    }
  };
  const close = () => { if (!busy) { modal.classList.remove('open'); releasePreview(); } };
  $('#cancelAppearance').onclick = close; modal.onclick = event => { if (event.target === modal) close(); };
  fileInput.onchange = () => {
    releasePreview(); const file = fileInput.files[0]; pendingCrop = null;
    if (file && !file.type.startsWith('image/')) { fileInput.value = ''; cropButton.disabled = true; toast('画像ファイルを選んでください'); return; }
    cropButton.disabled = !file && !db.appearance?.backgroundId;
    if (file) { temporaryURL = URL.createObjectURL(file); setPreview(temporaryURL); }
  };
  cropButton.onclick = async () => {
    const source = fileInput.files[0] || (db.appearance?.backgroundId ? await getPhotoURL(db.appearance.backgroundId) : null);
    if (!source) { toast('画像を選んでください'); return; }
    const crop = await chooseImageCrop(source,{aspectRatio:() => window.innerWidth / window.innerHeight,initialCrop:pendingCrop});
    if (crop) { pendingCrop = crop; updatePreviewCrop(); }
  };
  shade.oninput = updateShade;
  const setBusy = value => { busy = value; form.querySelectorAll('button,input').forEach(element => { element.disabled = value; }); if (!value) { $('#removeBackground').disabled = !db.appearance?.backgroundId; cropButton.disabled = !fileInput.files.length && !db.appearance?.backgroundId; } };
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const file = fileInput.files[0], previous = db.appearance;
    if (!file && !previous?.backgroundId) { toast('背景にする画像を選んでください'); return; }
    let newId; setBusy(true);
    try {
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error();
        const image = new Image(); image.src = temporaryURL; await image.decode();
        newId = `background-${crypto.randomUUID()}`; await savePhoto(newId,file);
      }
      db.appearance = {backgroundId:newId || previous.backgroundId,shade:Number(shade.value),crop:pendingCrop};
      try { save(); } catch (error) { db.appearance = previous; throw error; }
      await apply(); modal.classList.remove('open'); releasePreview();
      if (newId && previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {});
      toast('背景を保存しました');
    } catch { if (newId) deletePhoto(newId).catch(() => {}); toast('背景を保存できませんでした。画像と空き容量を確認してください'); }
    finally { setBusy(false); }
  };
  $('#removeBackground').onclick = async () => {
    if (busy) return;
    const previous = db.appearance; db.appearance = {shade:previous?.shade ?? 0};
    try { save(); } catch { db.appearance = previous; toast('背景の解除を保存できませんでした'); return; }
    setBusy(true); await apply(); modal.classList.remove('open'); releasePreview();
    if (previous?.backgroundId) deletePhoto(previous.backgroundId).catch(() => {});
    setBusy(false); toast('背景を解除しました');
  };
  window.addEventListener('resize',() => { positionBackground(); if (modal.classList.contains('open')) updatePreviewCrop(); });
  apply();
}
