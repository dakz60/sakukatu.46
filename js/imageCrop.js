'use strict';

function imageCropLayout(imageWidth, imageHeight, width, height, crop = {}) {
  const zoom = Math.max(1, Math.min(4, Number(crop?.zoom) || 1));
  const scale = Math.max(width / imageWidth, height / imageHeight) * zoom;
  const renderedWidth = imageWidth * scale, renderedHeight = imageHeight * scale;
  const cx = Math.max(width / (2 * renderedWidth), Math.min(1 - width / (2 * renderedWidth), Number.isFinite(crop?.cx) ? crop.cx : .5));
  const cy = Math.max(height / (2 * renderedHeight), Math.min(1 - height / (2 * renderedHeight), Number.isFinite(crop?.cy) ? crop.cy : .5));
  return {width:renderedWidth, height:renderedHeight, x:width / 2 - cx * renderedWidth, y:height / 2 - cy * renderedHeight, crop:{cx,cy,zoom}};
}

function applyAvatarCrop(image, crop) {
  if (!image.naturalWidth) return;
  const layout = imageCropLayout(image.naturalWidth,image.naturalHeight,1,1,crop);
  Object.assign(image.style,{position:'absolute',width:`${layout.width * 100}%`,height:`${layout.height * 100}%`,left:`${layout.x * 100}%`,top:`${layout.y * 100}%`,maxWidth:'none',objectFit:'fill'});
}

let activeCropEditor = false;
async function chooseImageCrop(source, {aspectRatio = 1, round = false, initialCrop = null} = {}) {
  if (activeCropEditor) return null;
  activeCropEditor = true;
  const previousFocus = document.activeElement, owner = document.activeElement?.closest('.modal-wrap');
  const localURL = source instanceof Blob ? URL.createObjectURL(source) : null;
  const image = new Image(); image.src = localURL || source;
  try { await image.decode(); } catch { if (localURL) URL.revokeObjectURL(localURL); activeCropEditor = false; toast('画像を読み込めませんでした'); return null; }
  if (owner && !owner.classList.contains('open')) { if (localURL) URL.revokeObjectURL(localURL); activeCropEditor = false; return null; }
  const modal = $('#cropModal'), canvas = $('#cropCanvas'), zoom = $('#cropZoom');
  const ratio = () => typeof aspectRatio === 'function' ? aspectRatio() : aspectRatio;
  let crop = imageCropLayout(image.naturalWidth,image.naturalHeight,ratio(),1,initialCrop).crop;
  let width, height, layout, drag;
  const context = canvas.getContext('2d');
  modal.classList.add('open');
  canvas.classList.toggle('round-crop',round);
  function draw() {
    const maxWidth = Math.max(100, modal.querySelector('.modal').clientWidth - 52);
    width = Math.min(maxWidth,window.innerHeight * .42 * ratio()); height = width / ratio();
    const pixels = Math.min(window.devicePixelRatio || 1,2);
    canvas.width = Math.round(width * pixels); canvas.height = Math.round(height * pixels);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    context.setTransform(pixels,0,0,pixels,0,0);
    layout = imageCropLayout(image.naturalWidth,image.naturalHeight,width,height,crop); crop = layout.crop;
    context.clearRect(0,0,width,height); context.drawImage(image,layout.x,layout.y,layout.width,layout.height);
    zoom.value = crop.zoom; $('#cropZoomValue').textContent = `${Math.round(crop.zoom * 100)}%`;
  }
  draw(); canvas.focus();
  return new Promise(resolve => {
    function finish(result) {
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
      drag = null; modal.classList.remove('open');
      canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = canvas.onkeydown = null;
      zoom.oninput = null; $('#confirmCrop').onclick = $('#cancelCrop').onclick = $('#resetCrop').onclick = null;
      modal.onclick = null; document.removeEventListener('keydown',onKey,true); window.removeEventListener('resize',draw);
      if (localURL) URL.revokeObjectURL(localURL);
      activeCropEditor = false; previousFocus?.focus({preventScroll:true}); resolve(result);
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(null); }
      if (event.key === 'Tab') {
        const controls = [canvas,zoom,$('#resetCrop'),$('#cancelCrop'),$('#confirmCrop')];
        const index = controls.indexOf(document.activeElement);
        if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1)) { event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus(); }
      }
    }
    canvas.onpointerdown = event => { if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return; drag = {id:event.pointerId,x:event.clientX,y:event.clientY,crop:{...crop},width:layout.width,height:layout.height}; canvas.setPointerCapture(event.pointerId); };
    canvas.onpointermove = event => { if (!drag || drag.id !== event.pointerId) return; crop = {...drag.crop,cx:drag.crop.cx - (event.clientX-drag.x)/drag.width,cy:drag.crop.cy - (event.clientY-drag.y)/drag.height}; draw(); };
    canvas.onpointerup = canvas.onpointercancel = () => { drag = null; };
    canvas.onkeydown = event => {
      const shifts = {ArrowLeft:[-.02,0],ArrowRight:[.02,0],ArrowUp:[0,-.02],ArrowDown:[0,.02]};
      if (shifts[event.key]) { event.preventDefault(); crop.cx += shifts[event.key][0]; crop.cy += shifts[event.key][1]; draw(); }
    };
    zoom.oninput = () => { crop.zoom = Number(zoom.value); draw(); };
    $('#resetCrop').onclick = () => { crop = {cx:.5,cy:.5,zoom:1}; draw(); };
    $('#confirmCrop').onclick = () => finish({...crop}); $('#cancelCrop').onclick = () => finish(null);
    modal.onclick = event => { if (event.target === modal) finish(null); };
    document.addEventListener('keydown',onKey,true); window.addEventListener('resize',draw);
  });
}

function attachAvatarCrop(input, wrap, existingId, initialCrop) {
  input.imageCrop = initialCrop || null;
  const preview = document.createElement('span'); preview.className = 'avatar-crop-preview'; preview.hidden = true;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'subtle crop-control'; button.textContent = '切り取り位置'; button.dataset.cropInput = input.name; button.disabled = !existingId;
  button.setAttribute('aria-label', `${input.name === 'memberAvatar' ? 'メンバー' : '自分'}のアイコンの切り取り位置`);
  wrap.append(preview,button);
  let selectedURL, revision = 0;
  async function source() { return input.files[0] || (existingId ? await getPhotoURL(existingId) : null); }
  async function show() {
    const current = ++revision, value = await source();
    if (current !== revision || !input.isConnected) return;
    if (selectedURL) URL.revokeObjectURL(selectedURL);
    selectedURL = value instanceof Blob ? URL.createObjectURL(value) : null;
    const url = selectedURL || value;
    preview.replaceChildren(); preview.hidden = !url; button.disabled = !url;
    if (url) { const image = new Image(); image.alt = 'アイコンの切り取り位置'; image.onload = () => { applyAvatarCrop(image,input.imageCrop); if (selectedURL && selectedURL === url) { URL.revokeObjectURL(selectedURL); selectedURL = null; } }; image.src = url; preview.append(image); }
  }
  input.addEventListener('change',() => { input.imageCrop = null; show(); });
  button.onclick = async () => { const value = await source(); if (!value) return; const crop = await chooseImageCrop(value,{round:true,initialCrop:input.imageCrop}); if (crop) { input.imageCrop = crop; show(); } };
  show();
}
