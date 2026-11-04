'use strict';

function initForms() {
  let collection = '';
  let editing = null;
  let busy = false;
  let conversation = [];

  function open(name, item = null, defaults = {}) {
    if (!forms[name]) return;

    collection = name;
    editing = item;

    const values = item || defaults;
    const form = $('#itemForm');

    form.dataset.sourceId = values.sourceId || '';
    form.dataset.sourceCollection = values.sourceCollection || '';
    form.dataset.catalogId = values.catalogId || '';
    form.dataset.catalogMember = values.member || '';
    form.dataset.catalogSeries = values.series || '';
    form.dataset.inventory =
      item?.inventory ||
      defaults.inventory ||
      (photoView === 'owned' ? 'collection' : photoView);

    const editTitles = {
      photos: '生写真',
      reports: 'ミーグリレポ',
      tickets: '応募・チケット',
      schedule: '予定',
      lives: '参戦記録',
      goods: 'グッズ',
      money: '支出',
      todos: 'ToDo',
      places: 'スポット',
      milestones: '記念日'
    };

    $('#modalTitle').textContent = item
      ? `${editTitles[name] || '記録'}を編集`
      : forms[name].title;

    if (name === 'photos') {
      const inventoryLabel = {
        collection: 'コレクション',
        offer: '提供用',
        want: '希望'
      }[form.dataset.inventory];

      $('#modalTitle').textContent =
        `${inventoryLabel}を${item ? '編集' : '登録'}`;
    }

    const box = $('#formFields');
    box.replaceChildren();

    for (const [key, label, kind, required, choices] of forms[name].fields) {
      const wrap = document.createElement('div');
      wrap.className =
        'field' + (['textarea', 'members'].includes(kind) ? ' full' : '');

      if (kind === 'members') {
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'member-checkboxes';

        const legend = document.createElement('legend');
        legend.textContent = label;
        fieldset.append(legend);

        for (const member of members) {
          const row = document.createElement('label');
          const input = document.createElement('input');

          input.type = 'checkbox';
          input.name = key;
          input.value = member.name;
          input.checked = (values.members || []).includes(member.name);

          row.append(input, document.createTextNode(member.name));
          fieldset.append(row);
        }

        wrap.append(fieldset);
        box.append(wrap);
        continue;
      }

      const input = document.createElement(
        kind === 'select'
          ? 'select'
          : kind === 'textarea'
            ? 'textarea'
            : 'input'
      );

      if (kind === 'select') {
        for (const choice of choices) {
          const option = document.createElement('option');
          option.textContent = choice;
          input.append(option);
        }
      } else if (kind !== 'textarea') {
        input.type = kind === 'member' ? 'text' : kind;
      }

      input.id = `field-${key}`;
      input.name = key;
      input.required = required;

      if (kind === 'file') {
        input.accept = 'image/*';
      } else if (kind === 'date') {
        const date = new Date();
        const today = new Date(
          date.getTime() - date.getTimezoneOffset() * 60000
        ).toISOString().slice(0, 10);

        input.value = values[key] ?? (required ? today : '');
      } else {
        input.value = values[key] ?? (
          kind === 'select' ? choices[0] : ''
        );
      }

      if (name === 'reports' && key === 'tickets') {
        input.min = '1';
        input.max = '9999';
        input.step = '1';
      }

      if (name === 'photos' && key === 'count') {
        input.min = '0';
        input.max = '99999';
        input.step = '1';
        input.value = item ? photoCount(item) : (defaults.count ?? 1);
      }

      const caption = document.createElement('label');
      caption.htmlFor = input.id;
      caption.textContent = label + (required ? ' *' : '');

      wrap.append(caption, input);

      if (key === 'photo' && name === 'photos') {
        const preview = document.createElement('img');
        preview.className = 'editor-image';
        preview.alt = '登録する生写真';
        preview.hidden = true;

        if (item) {
          getPhotoURL(item.imageId || item.id)
            .then((url) => {
              if (
                url &&
                preview.isConnected &&
                !input.files.length
              ) {
                preview.src = url;
                preview.hidden = false;
              }
            })
            .catch(() => {});
        }

        let temporaryURL;

        input.addEventListener('change', () => {
          if (temporaryURL) URL.revokeObjectURL(temporaryURL);

          const file = input.files[0];

          if (file) {
            temporaryURL = URL.createObjectURL(file);
            preview.src = temporaryURL;
            preview.hidden = false;

            preview.onload = () => {
              URL.revokeObjectURL(temporaryURL);
            };
          }
        });

        wrap.append(preview);
      }

      if (key === 'photo' && item) {
        const hint = document.createElement('small');
        hint.textContent =
          '画像を選ばなければ現在の画像を保持します';
        wrap.append(hint);
      }

      if (name === 'photos' && key === 'pose') {
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.name = 'customPose';
        custom.id = 'field-customPose';
        custom.placeholder = '例外のポーズ・種類を入力';

        const customLabel = document.createElement('label');
        customLabel.htmlFor = custom.id;
        customLabel.textContent = 'その他のポーズ・種類 *';

        const known = choices.slice(0, -1);

        if (values.pose && !known.includes(values.pose)) {
          input.value = 'その他';
          custom.value = values.pose;
        }

        const updateCustom = () => {
          const show = input.value === 'その他';

          custom.hidden = !show;
          customLabel.hidden = !show;
          custom.disabled = !show;
          custom.required = show;
        };

        input.addEventListener('change', updateCustom);
        updateCustom();

        wrap.append(customLabel, custom);
      }

      box.append(wrap);

      if (
        name === 'reports' &&
        ['memberAvatar', 'selfAvatar'].includes(key)
      ) {
        attachAvatarCrop(
          input,
          wrap,
          values[`${key}Id`],
          values[`${key}Crop`]
        );
      }

      if (kind === 'member') {
        attachMemberAutocomplete(input);
      }
    }

    if (name === 'photos') {
      const wrap = document.createElement('div');
      wrap.className = 'field full';

      const label = document.createElement('label');
      label.htmlFor = 'photoCatalogLink';
      label.textContent = '同名シリーズの項目';

      const select = document.createElement('select');
      select.id = 'photoCatalogLink';

      const updateLink = () => {
        const member = $('#field-member').value;
        const series = $('#field-series').value.trim();

        const entries = memberPhotoSeries(member).filter(
          (entry) => entry.title === series
        );

        const current = form.dataset.catalogId;

        select.replaceChildren();

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '未指定（元の登録を保持）';
        select.append(emptyOption);

        for (const entry of entries) {
          const option = document.createElement('option');
          option.value = entry.id;
          option.textContent =
            `同名項目 ${entry.occurrence}（原文の順番）`;
          select.append(option);
        }

        select.value = entries.some(
          (entry) => entry.id === current
        ) ? current : '';

        wrap.hidden = entries.length < 2;
      };

      select.onchange = () => {
        form.dataset.catalogId = select.value;
        form.dataset.catalogMember = $('#field-member').value;
        form.dataset.catalogSeries =
          $('#field-series').value.trim();
      };

      $('#field-member').addEventListener('change', updateLink);
      $('#field-series').addEventListener('input', updateLink);

      wrap.append(label, select);
      box.append(wrap);
      updateLink();
    }

    conversation = name === 'reports'
      ? createReportEditor(box, values)
      : [];

    $('#modalWrap').classList.add('open');
  }

  document.addEventListener('photoformrequest', (event) => {
    if (busy) return;

    const { item = null, defaults = {} } = event.detail;
    open('photos', item, defaults);
  });

  document.body.addEventListener('click', (event) => {
    if (busy) return;

    const recordEdit = event.target.closest('[data-edit-record]');

    if (
      recordEdit &&
      ['schedule', 'lives', 'goods', 'money', 'todos', 'places']
        .includes(recordEdit.dataset.editRecord)
    ) {
      const name = recordEdit.dataset.editRecord;
      const item = db[name][Number(recordEdit.dataset.index)];

      if (item) open(name, item);
      return;
    }

    const edit = event.target.closest(
      '[data-edit-photo], [data-edit-milestone], ' +
      '[data-edit-report], [data-edit-ticket]'
    );

    if (edit) {
      const name = edit.hasAttribute('data-edit-photo')
        ? 'photos'
        : edit.hasAttribute('data-edit-report')
          ? 'reports'
          : edit.hasAttribute('data-edit-ticket')
            ? 'tickets'
            : 'milestones';

      const index = Number(
        name === 'photos'
          ? edit.dataset.editPhoto
          : name === 'reports'
            ? edit.dataset.editReport
            : name === 'tickets'
              ? edit.dataset.editTicket
              : edit.dataset.editMilestone
      );

      open(name, db[name][index]);
      return;
    }

    const source = event.target.closest('[data-create-milestone]');

    if (source) {
      const sourceCollection = source.dataset.createMilestone;
      const record = db[sourceCollection][Number(source.dataset.index)];

      const linked = db.milestones.find(
        (item) =>
          item.sourceId === String(record.id) &&
          item.sourceCollection === sourceCollection
      );

      if (linked) {
        open('milestones', linked);
        return;
      }

      open('milestones', null, {
        title: record.title || '初ミーグリ',
        date: record.date,
        note: [
          record.note,
          ...(record.messages || []).map((message) => {
            if (message.kind === 'image') return '（画像）';

            const speaker = message.kind === 'member'
              ? record.member
              : message.kind === 'self'
                ? '自分'
                : 'メモ';

            return `${speaker}：${message.text}`;
          })
        ].filter(Boolean).join('\n'),
        members: record.member ? [record.member] : [],
        sourceId: String(record.id),
        sourceCollection
      });

      return;
    }

    const add = event.target.closest('[data-add]');

    if (add) {
      open(
        add.dataset.add,
        null,
        add.hasAttribute('data-wish')
          ? { inventory: 'want', count: 1 }
          : {}
      );
    }
  });

  const close = () => {
    if (!busy) {
      $('#modalWrap').classList.remove('open');
    }
  };

  $('#cancelBtn').onclick = close;

  $('#modalWrap').onclick = (event) => {
    if (event.target.id === 'modalWrap') close();
  };

  $('#itemForm').onsubmit = async (event) => {
    event.preventDefault();

    if (busy || !collection) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const item = {
      ...editing,
      ...Object.fromEntries(data.entries()),
      id: editing?.id ?? crypto.randomUUID()
    };

    const file = data.get('photo');
    delete item.photo;

    for (const [key, label, kind, required] of forms[collection].fields) {
      if (
        ['text', 'textarea', 'url', 'member'].includes(kind) &&
        typeof item[key] === 'string'
      ) {
        item[key] = item[key].trim();

        if (required && !item[key]) {
          toast(`${label}を入力してください`);
          return;
        }
      }
    }

    if (
      ['photos', 'reports'].includes(collection) &&
      !isMember(item.member)
    ) {
      toast('候補からメンバーを選んでください');
      return;
    }

    if (collection === 'photos') {
      item.count = Number(item.count);

      if (
        !Number.isSafeInteger(item.count) ||
        item.count < 0 ||
        item.count > 99999
      ) {
        toast('枚数は0〜99999の整数で入力してください');
        return;
      }

      item.inventory = form.dataset.inventory;

      delete item.offer;
      delete item.keep;
      delete item.want;

      if (item.pose === 'その他') {
        item.pose = (item.customPose || '').trim();
      }

      delete item.customPose;

      if (!item.pose) {
        toast('ポーズ・種類を入力してください');
        return;
      }

      if (
        form.dataset.catalogId &&
        item.member === form.dataset.catalogMember &&
        item.series.trim() === form.dataset.catalogSeries
      ) {
        item.catalogId = form.dataset.catalogId;
      } else {
        delete item.catalogId;
      }

      item.series = item.series.trim();

      if (!item.series) {
        toast('シリーズを入力してください');
        return;
      }

      item.status = item.count ? '所持' : '未所持';
    }

    if (collection === 'milestones') {
      item.members = data.getAll('members');

      if (!item.members.length) {
        toast('メンバーを1人以上選んでください');
        return;
      }

      item.title = item.title.trim();

      if (!item.title) {
        toast('タイトルを入力してください');
        return;
      }

      if (!editing && form.dataset.sourceId) {
        item.sourceId = form.dataset.sourceId;
        item.sourceCollection = form.dataset.sourceCollection;
      }
    }

    if (
      file instanceof File &&
      file.size &&
      !file.type.startsWith('image/')
    ) {
      toast('画像ファイルを選んでください');
      return;
    }

    busy = true;

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;

    const previous = [...db[collection]];
    const reportImages = [];

    let newImage;
    let persisted = false;

    try {
      if (collection === 'reports') {
        await prepareReport(item, form, conversation, reportImages);
      }

      if (file instanceof File && file.size) {
        newImage = `image-${crypto.randomUUID()}`;
        await savePhoto(newImage, file);
        item.imageId = newImage;
      }

      if (editing) {
        db[collection].splice(
          db[collection].indexOf(editing),
          1,
          item
        );
      } else {
        db[collection].unshift(item);
      }

      try {
        save();
      } catch (error) {
        db[collection] = previous;
        throw error;
      }

      persisted = true;

      if (collection === 'reports' && editing) {
        reportImageIds(editing)
          .filter(
            (id) =>
              !reportImageIds(item).includes(id) &&
              !imageInUse(id)
          )
          .forEach((id) => {
            deletePhoto(id).catch(() => {});
          });
      }

      if (newImage && editing) {
        const oldId = editing.imageId || editing.id;

        if (!imageInUse(oldId)) {
          deletePhoto(oldId).catch(() => {});
        }
      }

      const targetView = item.inventory === 'collection'
        ? 'owned'
        : item.inventory;

      if (collection === 'photos' && targetView !== photoView) {
        setPhotoView(targetView);
      } else {
        render();
      }

      $('#modalWrap').classList.remove('open');
      form.reset();
      toast('保存しました');
    } catch {
      if (!persisted) {
        reportImages.forEach((id) => {
          deletePhoto(id).catch(() => {});
        });
      }

      if (newImage && !persisted) {
        deletePhoto(newImage).catch(() => {});
      }

      toast('保存できませんでした。空き容量と画像を確認してください');
    } finally {
      busy = false;
      submit.disabled = false;
    }
  };
}
