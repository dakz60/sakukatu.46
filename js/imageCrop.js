'use strict';

function iconCropBackground(crop) {
  return ['transparent', 'white', 'black'].includes(
    crop?.background
  )
    ? crop.background
    : 'transparent';
}

function imageCropLayout(
  imageWidth,
  imageHeight,
  width,
  height,
  crop = {}
) {
  const freeMove = crop?.freeMove === true;

  const minZoom = freeMove ? 0.5 : 1;
  const maxZoom = freeMove ? 3 : 4;

  const zoom = Math.max(
    minZoom,
    Math.min(maxZoom, Number(crop?.zoom) || 1)
  );

  const scale =
    Math.max(
      width / imageWidth,
      height / imageHeight
    ) * zoom;

  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  const requestedX = Number.isFinite(crop?.cx)
    ? crop.cx
    : 0.5;

  const requestedY = Number.isFinite(crop?.cy)
    ? crop.cy
    : 0.5;

  const cx = freeMove
    ? requestedX
    : Math.max(
        width / (2 * renderedWidth),
        Math.min(
          1 - width / (2 * renderedWidth),
          requestedX
        )
      );

  const cy = freeMove
    ? requestedY
    : Math.max(
        height / (2 * renderedHeight),
        Math.min(
          1 - height / (2 * renderedHeight),
          requestedY
        )
      );

  return {
    width: renderedWidth,
    height: renderedHeight,
    x: width / 2 - cx * renderedWidth,
    y: height / 2 - cy * renderedHeight,

    crop: {
      cx,
      cy,
      zoom,

      ...(freeMove
        ? {
            freeMove: true,
            background: iconCropBackground(crop)
          }
        : {})
    }
  };
}

function applyAvatarCrop(image, crop) {
  if (!image.naturalWidth) return;

  const layout = imageCropLayout(
    image.naturalWidth,
    image.naturalHeight,
    1,
    1,
    crop
  );

  if (image.parentElement) {
    image.parentElement.style.backgroundColor =
      crop?.freeMove === true
        ? iconCropBackground(crop)
        : '';
  }

  Object.assign(image.style, {
    position: 'absolute',
    width: `${layout.width * 100}%`,
    height: `${layout.height * 100}%`,
    left: `${layout.x * 100}%`,
    top: `${layout.y * 100}%`,
    maxWidth: 'none',
    objectFit: 'fill'
  });
}

let activeCropEditor = false;

async function chooseImageCrop(
  source,
  {
    aspectRatio = 1,
    round = false,
    initialCrop = null,
    freeMove = round
  } = {}
) {
  if (activeCropEditor) return null;

  activeCropEditor = true;

  const previousFocus = document.activeElement;

  const owner =
    document.activeElement?.closest('.modal-wrap');

  const localURL = source instanceof Blob
    ? URL.createObjectURL(source)
    : null;

  const image = new Image();

  image.src = localURL || source;

  try {
    await image.decode();
  } catch {
    if (localURL) {
      URL.revokeObjectURL(localURL);
    }

    activeCropEditor = false;

    toast('画像を読み込めませんでした');

    return null;
  }

  if (
    owner &&
    !owner.classList.contains('open')
  ) {
    if (localURL) {
      URL.revokeObjectURL(localURL);
    }

    activeCropEditor = false;

    return null;
  }

  const modal = $('#cropModal');
  const canvas = $('#cropCanvas');
  const zoom = $('#cropZoom');

  const previousMin = zoom.min;
  const previousMax = zoom.max;

  zoom.min = freeMove ? '0.5' : '1';
  zoom.max = freeMove ? '3' : '4';

  const context = canvas.getContext('2d');

  const hint = modal.querySelector('.field-hint');
  const previousHint = hint?.textContent;

  if (hint && freeMove) {
    hint.textContent =
      '画像を上下左右に自由に動かせます。余白ができても保存できます。中央に戻すと位置をリセットできます。';
  }

  const ratio = () =>
    typeof aspectRatio === 'function'
      ? aspectRatio()
      : aspectRatio;

  let crop = imageCropLayout(
    image.naturalWidth,
    image.naturalHeight,
    ratio(),
    1,
    {
      ...initialCrop,
      freeMove
    }
  ).crop;

  let backgroundField = $('#cropBackgroundField');

  if (!backgroundField && freeMove) {
    backgroundField = document.createElement('div');
    backgroundField.id = 'cropBackgroundField';
    backgroundField.className = 'field';

    const label = document.createElement('label');

    label.htmlFor = 'cropBackgroundColor';
    label.textContent = '余白の色';

    const select = document.createElement('select');

    select.id = 'cropBackgroundColor';

    for (const [value, text] of [
      ['transparent', '透明'],
      ['white', '白'],
      ['black', '黒']
    ]) {
      const option = document.createElement('option');

      option.value = value;
      option.textContent = text;

      select.append(option);
    }

    backgroundField.append(label, select);

    zoom.closest('.field').after(backgroundField);
  }

  const backgroundSelect =
    backgroundField?.querySelector('select');

  if (backgroundField) {
    backgroundField.hidden = !freeMove;
    backgroundField.style.display = freeMove ? '' : 'none';
  }

  if (backgroundSelect) {
    backgroundSelect.value = iconCropBackground(crop);
  }

  let width;
  let height;
  let layout;
  let drag;

  modal.classList.add('open');
  canvas.classList.toggle('round-crop', round);

  function draw() {
    const maxWidth = Math.max(
      100,
      modal.querySelector('.modal').clientWidth - 52
    );

    width = Math.min(
      maxWidth,
      window.innerHeight * 0.42 * ratio()
    );

    height = width / ratio();

    const pixels = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    canvas.width = Math.round(width * pixels);
    canvas.height = Math.round(height * pixels);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(
      pixels,
      0,
      0,
      pixels,
      0,
      0
    );

    layout = imageCropLayout(
      image.naturalWidth,
      image.naturalHeight,
      width,
      height,
      crop
    );

    crop = layout.crop;

    context.clearRect(0, 0, width, height);

    if (freeMove) {
      const background = iconCropBackground(crop);

      if (background === 'transparent') {
        const size = 12;

        context.fillStyle = '#eee9ed';
        context.fillRect(0, 0, width, height);

        context.fillStyle = '#d8d1d7';

        for (let y = 0; y < height; y += size) {
          for (let x = 0; x < width; x += size) {
            if ((x / size + y / size) % 2 === 0) {
              context.fillRect(x, y, size, size);
            }
          }
        }
      } else {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
      }
    }

    context.drawImage(
      image,
      layout.x,
      layout.y,
      layout.width,
      layout.height
    );

    zoom.value = crop.zoom;

    $('#cropZoomValue').textContent =
      `${Math.round(crop.zoom * 100)}%`;
  }

  draw();

  canvas.focus();

  return new Promise((resolve) => {
    function finish(result) {
      if (
        drag &&
        canvas.hasPointerCapture(drag.id)
      ) {
        canvas.releasePointerCapture(drag.id);
      }

      drag = null;

      modal.classList.remove('open');

      if (hint) {
        hint.textContent = previousHint;
      }

      canvas.onpointerdown = null;
      canvas.onpointermove = null;
      canvas.onpointerup = null;
      canvas.onpointercancel = null;
      canvas.onkeydown = null;

      zoom.oninput = null;
      zoom.min = previousMin;
      zoom.max = previousMax;

      if (backgroundSelect) {
        backgroundSelect.onchange = null;
      }

      if (backgroundField) {
        backgroundField.hidden = true;
        backgroundField.style.display = 'none';
      }

      $('#confirmCrop').onclick = null;
      $('#cancelCrop').onclick = null;
      $('#resetCrop').onclick = null;

      modal.onclick = null;

      document.removeEventListener(
        'keydown',
        onKey,
        true
      );

      window.removeEventListener(
        'resize',
        draw
      );

      if (localURL) {
        URL.revokeObjectURL(localURL);
      }

      activeCropEditor = false;

      previousFocus?.focus({
        preventScroll: true
      });

      resolve(result);
    }

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        finish(null);
      }

      if (event.key === 'Tab') {
        const controls = [
          canvas,
          zoom,

          ...(
            freeMove && backgroundSelect
              ? [backgroundSelect]
              : []
          ),

          $('#resetCrop'),
          $('#cancelCrop'),
          $('#confirmCrop')
        ];

        const index = controls.indexOf(
          document.activeElement
        );

        if (
          (event.shiftKey && index <= 0) ||
          (
            !event.shiftKey &&
            index === controls.length - 1
          )
        ) {
          event.preventDefault();

          controls[
            event.shiftKey
              ? controls.length - 1
              : 0
          ].focus();
        }
      }
    }

    canvas.onpointerdown = (event) => {
      if (
        drag ||
        (
          event.pointerType === 'mouse' &&
          event.button !== 0
        )
      ) {
        return;
      }

      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        crop: { ...crop },
        width: layout.width,
        height: layout.height
      };

      canvas.setPointerCapture(event.pointerId);
    };

    canvas.onpointermove = (event) => {
      if (
        !drag ||
        drag.id !== event.pointerId
      ) {
        return;
      }

      crop = {
        ...drag.crop,

        cx:
          drag.crop.cx -
          (event.clientX - drag.x) / drag.width,

        cy:
          drag.crop.cy -
          (event.clientY - drag.y) / drag.height
      };

      draw();
    };

    canvas.onpointerup =
      canvas.onpointercancel = () => {
        drag = null;
      };

    canvas.onkeydown = (event) => {
      const shifts = {
        ArrowLeft: [-0.02, 0],
        ArrowRight: [0.02, 0],
        ArrowUp: [0, -0.02],
        ArrowDown: [0, 0.02]
      };

      if (shifts[event.key]) {
        event.preventDefault();

        crop.cx += shifts[event.key][0];
        crop.cy += shifts[event.key][1];

        draw();
      }
    };

    if (backgroundSelect) {
      backgroundSelect.onchange = () => {
        crop.background = iconCropBackground({
          background: backgroundSelect.value
        });

        draw();
      };
    }

    zoom.oninput = () => {
      crop.zoom = Number(zoom.value);

      draw();
    };

    $('#resetCrop').onclick = () => {
      crop = {
        cx: 0.5,
        cy: 0.5,
        zoom: 1,

        ...(freeMove
          ? {
              freeMove: true,
              background: iconCropBackground(crop)
            }
          : {})
      };

      draw();
    };

    $('#confirmCrop').onclick = () => {
      finish({ ...crop });
    };

    $('#cancelCrop').onclick = () => {
      finish(null);
    };

    modal.onclick = (event) => {
      if (event.target === modal) {
        finish(null);
      }
    };

    document.addEventListener(
      'keydown',
      onKey,
      true
    );

    window.addEventListener(
      'resize',
      draw
    );
  });
}

function attachAvatarCrop(
  input,
  wrap,
  existingId,
  initialCrop
) {
  input.imageCrop = initialCrop || null;

  const preview = document.createElement('span');

  preview.className = 'avatar-crop-preview';
  preview.hidden = true;

  const button = document.createElement('button');

  button.type = 'button';
  button.className = 'subtle crop-control';
  button.textContent = '切り取り位置';
  button.dataset.cropInput = input.name;
  button.disabled = !existingId;

  button.setAttribute(
    'aria-label',
    `${
      input.name === 'memberAvatar'
        ? 'メンバー'
        : '自分'
    }のアイコンの切り取り位置`
  );

  wrap.append(preview, button);

  let selectedURL;
  let revision = 0;

  async function source() {
    return (
      input.files[0] ||
      (
        existingId
          ? await getPhotoURL(existingId)
          : null
      )
    );
  }

  async function show() {
    const current = ++revision;
    const value = await source();

    if (
      current !== revision ||
      !input.isConnected
    ) {
      return;
    }

    if (selectedURL) {
      URL.revokeObjectURL(selectedURL);
    }

    selectedURL = value instanceof Blob
      ? URL.createObjectURL(value)
      : null;

    const url = selectedURL || value;

    preview.replaceChildren();
    preview.hidden = !url;
    button.disabled = !url;

    if (url) {
      const image = new Image();

      image.alt = 'アイコンの切り取り位置';

      image.onload = () => {
        applyAvatarCrop(
          image,
          input.imageCrop
        );

        if (
          selectedURL &&
          selectedURL === url
        ) {
          URL.revokeObjectURL(selectedURL);
          selectedURL = null;
        }
      };

      image.src = url;

      preview.append(image);
    }
  }

  input.addEventListener('change', () => {
    input.imageCrop = null;

    show().catch(() => {
      toast('アイコン画像を読み込めませんでした');
    });
  });

  button.onclick = async () => {
    try {
      const value = await source();

      if (!value) return;

      const crop = await chooseImageCrop(value, {
        round: true,
        initialCrop: input.imageCrop
      });

      if (crop) {
        input.imageCrop = crop;

        await show();
      }
    } catch {
      toast('アイコン画像を読み込めませんでした');
    }
  };

  show().catch(() => {
    toast('アイコン画像を読み込めませんでした');
  });
}
