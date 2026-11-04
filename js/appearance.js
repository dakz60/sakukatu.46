'use strict';

function initAppearance() {
  const modal = $('#appearanceModal');
  const form = $('#appearanceForm');
  const fileInput = $('#backgroundFile');
  const cropButton = $('#cropBackground');
  const preview = $('#backgroundPreview');

  let editingPage = 'home';
  let temporaryURL = '';
  let busy = false;
  let generation = 0;
  let previewRevision = 0;
  let pendingCrop = null;
  let previewImage = null;
  let backgroundImage = null;

  function activePage() {
    return $('#nav [data-page].active')?.dataset.page || 'home';
  }

  function settingsFor(page) {
    return db.appearance?.pages?.[page] || db.appearance || {};
  }

  function editingSettings() {
    return settingsFor(editingPage);
  }

  function storeSettings(settings) {
    const previous = db.appearance;

    db.appearance = {
      ...previous,
      pages: {
        ...previous?.pages,
        [editingPage]: settings
      }
    };

    try {
      save();
    } catch (error) {
      db.appearance = previous;
      throw error;
    }
  }

  function deleteUnusedBackground(id) {
    if (id && !imageInUse(id)) {
      deletePhoto(id).catch(() => {});
    }
  }

  function releasePreview() {
    if (temporaryURL) {
      URL.revokeObjectURL(temporaryURL);
    }

    temporaryURL = '';
  }

  function updatePreviewCrop() {
    const ratio = window.innerWidth / window.innerHeight;
    const height = Math.min(200, form.clientWidth / ratio);

    Object.assign(preview.style, {
      width: `${height * ratio}px`,
      height: `${height}px`,
      minHeight: '0',
      marginLeft: 'auto',
      marginRight: 'auto'
    });

    if (!previewImage) return;

    const layout = imageCropLayout(
      previewImage.naturalWidth,
      previewImage.naturalHeight,
      preview.clientWidth,
      preview.clientHeight,
      pendingCrop
    );

    preview.style.backgroundSize =
      `${layout.width}px ${layout.height}px`;

    preview.style.backgroundPosition =
      `${layout.x}px ${layout.y}px`;
  }

  function setPreview(url) {
    const revision = ++previewRevision;

    previewImage = null;
    preview.style.backgroundImage = url ? `url("${url}")` : 'none';
    preview.style.backgroundSize = '';
    preview.style.backgroundPosition = '';
    preview.style.setProperty('--preview-shade', '0');
    preview.classList.toggle('has-image', !!url);

    updatePreviewCrop();

    if (!url) return;

    const image = new Image();

    image.onload = () => {
      if (revision !== previewRevision) return;

      previewImage = image;
      updatePreviewCrop();
    };

    image.src = url;
  }

  function clearBackground() {
    backgroundImage = null;

    for (const key of [
      '--user-background',
      '--user-background-size',
      '--user-background-position'
    ]) {
      document.body.style.removeProperty(key);
    }

    document.body.classList.remove('has-custom-background');
  }

  function positionBackground() {
    if (!backgroundImage) return;

    const layout = imageCropLayout(
      backgroundImage.naturalWidth,
      backgroundImage.naturalHeight,
      window.innerWidth,
      window.innerHeight,
      settingsFor(activePage()).crop
    );

    document.body.style.setProperty(
      '--user-background-size',
      `${layout.width}px ${layout.height}px`
    );

    document.body.style.setProperty(
      '--user-background-position',
      `${layout.x}px ${layout.y}px`
    );
  }

  async function apply() {
    const current = ++generation;
    const settings = settingsFor(activePage());

    document.body.style.setProperty('--background-shade', '0');
    clearBackground();

    if (!settings.backgroundId) return;

    try {
      const url = await getPhotoURL(settings.backgroundId);

      if (current !== generation) return;
      if (!url) throw new Error('背景画像がありません');

      const image = new Image();
      image.src = url;

      await image.decode();

      if (current !== generation) return;

      backgroundImage = image;
      positionBackground();

      document.body.style.setProperty(
        '--user-background',
        `url("${url}")`
      );

      document.body.classList.add('has-custom-background');
    } catch {
      if (current !== generation) return;

      clearBackground();

      toast(
        '背景画像を読み込めませんでした。背景の設定から選び直せます'
      );
    }
  }

  function updateButtons() {
    $('#removeBackground').disabled =
      busy || !editingSettings().backgroundId;

    cropButton.disabled =
      busy ||
      (!fileInput.files.length && !editingSettings().backgroundId);
  }

  function setBusy(value) {
    busy = value;

    form.querySelectorAll('button, input').forEach((element) => {
      element.disabled = value;
    });

    if (!value) updateButtons();
  }

  $('#appearanceBtn').onclick = async () => {
    if (busy) return;

    editingPage = activePage();

    const settings = editingSettings();

    $('#appearanceTitle').textContent =
      `${labels[editingPage] || 'ホーム'}の背景`;

    form.reset();
    releasePreview();

    pendingCrop = settings.crop || null;

    modal.classList.add('open');
    setPreview('');
    updateButtons();

    const revision = previewRevision;

    if (!settings.backgroundId) return;

    try {
      const url = await getPhotoURL(settings.backgroundId);

      if (
        revision === previewRevision &&
        modal.classList.contains('open') &&
        !fileInput.files.length
      ) {
        setPreview(url);
      }
    } catch {
      if (
        revision === previewRevision &&
        modal.classList.contains('open')
      ) {
        toast('背景画像を読み込めませんでした');
      }
    }
  };

  function close() {
    if (busy) return;

    modal.classList.remove('open');
    ++previewRevision;
    releasePreview();
  }

  $('#cancelAppearance').onclick = close;

  modal.onclick = (event) => {
    if (event.target === modal) close();
  };

  fileInput.onchange = () => {
    ++previewRevision;
    releasePreview();

    const file = fileInput.files[0];

    if (!file) {
      updateButtons();
      return;
    }

    if (!file.type.startsWith('image/')) {
      fileInput.value = '';
      updateButtons();
      toast('画像ファイルを選んでください');
      return;
    }

    pendingCrop = null;
    temporaryURL = URL.createObjectURL(file);

    setPreview(temporaryURL);
    updateButtons();
  };

  cropButton.onclick = async () => {
    if (busy) return;

    const revision = previewRevision;

    try {
      const settings = editingSettings();

      const source =
        fileInput.files[0] ||
        (
          settings.backgroundId
            ? await getPhotoURL(settings.backgroundId)
            : null
        );

      if (
        revision !== previewRevision ||
        !modal.classList.contains('open')
      ) {
        return;
      }

      if (!source) {
        toast('画像を選んでください');
        return;
      }

      const crop = await chooseImageCrop(source, {
        aspectRatio: () => window.innerWidth / window.innerHeight,
        initialCrop: pendingCrop
      });

      if (crop && revision === previewRevision) {
        pendingCrop = crop;
        updatePreviewCrop();
      }
    } catch {
      toast('画像を読み込めませんでした');
    }
  };

  form.onsubmit = async (event) => {
    event.preventDefault();

    if (busy) return;

    const file = fileInput.files[0];
    const previous = editingSettings();

    if (!file && !previous.backgroundId) {
      toast('背景にする画像を選んでください');
      return;
    }

    let newId;
    let persisted = false;

    setBusy(true);

    try {
      if (file) {
        if (!file.type.startsWith('image/')) {
          throw new Error('画像ファイルではありません');
        }

        const image = new Image();
        image.src = temporaryURL;

        await image.decode();

        newId = `background-${crypto.randomUUID()}`;
        await savePhoto(newId, file);
      }

      storeSettings({
        backgroundId: newId || previous.backgroundId,
        crop: pendingCrop
      });

      persisted = true;

      await apply();

      modal.classList.remove('open');
      ++previewRevision;
      releasePreview();

      if (newId) {
        deleteUnusedBackground(previous.backgroundId);
      }

      toast('背景を保存しました');
    } catch {
      if (newId && !persisted) {
        deletePhoto(newId).catch(() => {});
      }

      toast(
        '背景を保存できませんでした。画像と空き容量を確認してください'
      );
    } finally {
      setBusy(false);
    }
  };

  $('#removeBackground').onclick = async () => {
    if (busy) return;

    const previous = editingSettings();

    try {
      storeSettings({});
    } catch {
      toast('背景の解除を保存できませんでした');
      return;
    }

    setBusy(true);

    try {
      await apply();

      modal.classList.remove('open');
      ++previewRevision;
      releasePreview();

      deleteUnusedBackground(previous.backgroundId);
      toast('背景を解除しました');
    } finally {
      setBusy(false);
    }
  };

  window.addEventListener('resize', () => {
    positionBackground();

    if (modal.classList.contains('open')) {
      updatePreviewCrop();
    }
  });

  document.addEventListener('pagechange', apply);
  apply();
}
