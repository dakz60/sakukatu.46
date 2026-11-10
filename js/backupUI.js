'use strict';

(() => {
  const anchor = document.querySelector('#appearanceBtn');

  if (!anchor || !window.OshiBackup) return;

  const open = document.createElement('button');

  open.type = 'button';
  open.className = 'subtle';
  open.textContent = 'データ引き継ぎ';

  anchor.after(open);

  const dialog = document.createElement('dialog');

  dialog.style.cssText = `
    box-sizing: border-box;
    width: min(440px, calc(100% - 32px));
    max-height: 85dvh;
    overflow: auto;
    padding: 24px;
    border-radius: 16px;
    border: 1px solid #ccc;
    background: #fff;
    color: #29252a;
  `;

  dialog.innerHTML = `
    <h2 style="margin-top: 0">
      データ引き継ぎ
    </h2>

    <p>
      写真・記録・設定を、ひとつのファイルにまとめます。
      外部サーバーには送りません。
    </p>

    <button type="button" data-export>
      引き継ぎファイルを保存
    </button>

    <hr>

    <label>
      別の端末で保存したファイルを選ぶ

      <input
        type="file"
        accept=".sakubackup"
        style="
          display: block;
          max-width: 100%;
          margin: 12px 0;
        "
      >
    </label>

    <p role="status" aria-live="polite"></p>

    <button type="button" data-restore hidden>
      この端末に読み込む
    </button>

    <p>
      読み込むと、この端末の記録はファイルの内容に置き換わります。
      現在の記録も先にファイルへ保存してください。
    </p>

    <button type="button" data-close>
      閉じる
    </button>
  `;

  document.body.append(dialog);

  const status = dialog.querySelector('[role="status"]');
  const restore = dialog.querySelector('[data-restore]');
  const input = dialog.querySelector('input');

  let busy = false;
  let selected;

  function setBusy(value) {
    busy = value;

    dialog
      .querySelectorAll('button, input')
      .forEach((element) => {
        element.disabled = value;
      });
  }

  function report({ phase, current, total }) {
    const messages = {
      capacity: '空き容量を確認しています…',
      prepare: '写真の保存先を準備しています…',
      save: `写真を保存しています ${current} / ${total}枚`,
      commit: '記録・設定を反映しています…',
      export: `写真を書き出しています ${current} / ${total}枚`,
      inspect: `写真を確認しています ${current} / ${total}枚`
    };

    status.textContent =
      messages[phase] || '処理しています…';
  }

  window.addEventListener('beforeunload', (event) => {
    if (!busy) return;

    event.preventDefault();
    event.returnValue = '';
  });

  dialog.addEventListener('cancel', (event) => {
    if (busy) {
      event.preventDefault();
    }
  });

  open.onclick = () => {
    dialog.showModal();
  };

  dialog.querySelector('[data-close]').onclick = () => {
    dialog.close();
  };

  dialog.querySelector('[data-export]').onclick = async () => {
    setBusy(true);

    status.textContent =
      '引き継ぎファイルを作成しています…';

    try {
      const blob = await OshiBackup.exportFile(
        db,
        report
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;

      link.download =
        `sakukatu46-${new Date().toISOString().slice(0, 10)}.sakubackup`;

      document.body.append(link);

      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);

      status.textContent =
        '保存操作を開始しました。ファイルが保存されたことを確認してください。';
    } catch (error) {
      status.textContent =
        error.message ||
        'ファイルを作成できませんでした';
    } finally {
      setBusy(false);
    }
  };

  input.onchange = async () => {
    selected = undefined;
    restore.hidden = true;

    const file = input.files[0];

    if (!file) return;

    setBusy(true);

    try {
      const preview = await OshiBackup.inspect(
        file,
        report
      );

      const records = Object.values(preview.data)
        .filter(Array.isArray)
        .reduce(
          (sum, items) => sum + items.length,
          0
        );

      status.textContent =
        `写真 ${preview.images.length}枚・一覧データ ${records}件を確認しました。`;

      selected = file;
      restore.hidden = false;
    } catch (error) {
      status.textContent =
        error.message || '読み込めませんでした';
    } finally {
      setBusy(false);
    }
  };

  restore.onclick = async () => {
    if (!selected) return;

    if (
      !confirm(
        'この端末の記録を、選んだファイルの内容に置き換えますか？'
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      await OshiBackup.restoreFile(
        selected,
        report
      );

      busy = false;

      location.reload();
    } catch (error) {
      status.textContent =
        error.message || '読み込めませんでした';

      setBusy(false);
    }
  };
})();
