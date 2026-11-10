'use strict';

(() => {
  const KEY = 'oshi-note-v1';
  const DEFAULT_DATABASE = 'sakurazaka-oshi-note-photos';
  const STORE = 'photos';

  const MAGIC = new TextEncoder().encode('SAKUBK01');
  const HEADER_SIZE = 44;
  const MAX_MANIFEST = 64 * 1024 * 1024;

  const COLLECTIONS = [
    'schedule',
    'tickets',
    'goods',
    'photos',
    'lives',
    'reports',
    'money',
    'todos',
    'places',
    'milestones',
    'trades'
  ];

  function progress(callback, phase, current, total) {
    callback?.({ phase, current, total });
  }

  function validateData(data) {
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error('記録データの形式が正しくありません');
    }

    const stack = [data];
    let visited = 0;

    while (stack.length) {
      const value = stack.pop();

      if (++visited > 500000) {
        throw new Error('記録データが大きすぎます');
      }

      if (!value || typeof value !== 'object') continue;

      for (const [key, child] of Object.entries(value)) {
        if (
          ['__proto__', 'constructor', 'prototype'].includes(key)
        ) {
          throw new Error('読み込めない項目が含まれています');
        }

        if (child && typeof child === 'object') {
          stack.push(child);
        }
      }
    }

    for (const name of COLLECTIONS) {
      if (data[name] === undefined) continue;

      if (
        !Array.isArray(data[name]) ||
        data[name].some(
          (item) =>
            !item ||
            typeof item !== 'object' ||
            Array.isArray(item)
        )
      ) {
        throw new Error(`${name}の記録形式が正しくありません`);
      }
    }

    if (
      data.profile !== undefined &&
      (
        !data.profile ||
        typeof data.profile !== 'object' ||
        Array.isArray(data.profile)
      )
    ) {
      throw new Error('プロフィールの形式が正しくありません');
    }

    for (const trade of data.trades || []) {
      if (
        !Array.isArray(trade.lines) ||
        trade.lines.some(
          (line) =>
            !line ||
            !['give', 'receive'].every(
              (key) =>
                Number.isSafeInteger(line[key]) &&
                line[key] >= 0 &&
                line[key] <= 99999
            )
        )
      ) {
        throw new Error('交換履歴の形式が正しくありません');
      }
    }
  }

  async function digest(blob) {
    const buffer = await blob.arrayBuffer();

    return new Uint8Array(
      await crypto.subtle.digest('SHA-256', buffer)
    );
  }

  function hex(bytes) {
    return [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function sameBytes(a, b) {
    return (
      a.length === b.length &&
      a.every((byte, index) => byte === b[index])
    );
  }

  function imageDatabaseName(data) {
    const name = data?.__photoDatabase || DEFAULT_DATABASE;

    if (
      name !== DEFAULT_DATABASE &&
      !/^sakurazaka-oshi-note-photos-import-[0-9a-f-]{36}$/.test(name)
    ) {
      throw new Error('画像保存先の形式が正しくありません');
    }

    return name;
  }

  function openImages(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };

      request.onerror = () => {
        reject(
          request.error ||
          new Error('写真の保存先を開けませんでした')
        );
      };

      request.onblocked = () => {
        reject(
          new Error('ほかのタブを閉じてからお試しください')
        );
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  function snapshotImages(database) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(
        STORE,
        'readonly'
      );

      const images = [];
      const request = transaction.objectStore(STORE).openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) return;

        if (
          typeof cursor.key !== 'string' ||
          !(cursor.value instanceof Blob) ||
          !cursor.value.size
        ) {
          transaction.abort();
          return;
        }

        images.push({
          key: cursor.key,
          blob: cursor.value
        });

        cursor.continue();
      };

      transaction.oncomplete = () => {
        resolve(images);
      };

      transaction.onerror = transaction.onabort = () => {
        reject(
          transaction.error ||
          new Error('保存済み画像を読み込めませんでした')
        );
      };
    });
  }

  async function exportFile(data, onProgress) {
    const previous = localStorage.getItem(KEY);
    const serialized = JSON.stringify(data);
    const snapshot = JSON.parse(serialized);

    validateData(snapshot);

    const databaseName = imageDatabaseName(snapshot);

    delete snapshot.__photoDatabase;

    const database = await openImages(databaseName);
    let images;

    try {
      images = await snapshotImages(database);
    } finally {
      database.close();
    }

    const entries = [];

    for (let index = 0; index < images.length; index++) {
      const image = images[index];

      entries.push({
        key: image.key,
        size: image.blob.size,
        type: image.blob.type,
        sha256: hex(await digest(image.blob))
      });

      progress(
        onProgress,
        'export',
        index + 1,
        images.length
      );
    }

    if (
      localStorage.getItem(KEY) !== previous ||
      JSON.stringify(data) !== serialized
    ) {
      throw new Error(
        '書き出し中に記録が更新されました。もう一度お試しください'
      );
    }

    const manifest = new Blob([
      JSON.stringify({
        format: 'sakukatu46-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        data: snapshot,
        images: entries
      })
    ]);

    if (manifest.size > MAX_MANIFEST) {
      throw new Error('記録データが大きすぎます');
    }

    const header = new Uint8Array(HEADER_SIZE);

    header.set(MAGIC);

    new DataView(header.buffer).setUint32(
      8,
      manifest.size
    );

    header.set(await digest(manifest), 12);

    return new Blob(
      [
        header,
        manifest,
        ...images.map((image) => image.blob)
      ],
      {
        type: 'application/octet-stream'
      }
    );
  }

  async function inspect(file, onProgress) {
    if (
      !(file instanceof Blob) ||
      file.size < HEADER_SIZE
    ) {
      throw new Error('引き継ぎファイルを選んでください');
    }

    const header = new Uint8Array(
      await file.slice(0, HEADER_SIZE).arrayBuffer()
    );

    if (!sameBytes(header.slice(0, 8), MAGIC)) {
      throw new Error(
        'このサイトの引き継ぎファイルではありません'
      );
    }

    const length = new DataView(
      header.buffer
    ).getUint32(8);

    if (
      !length ||
      length > MAX_MANIFEST ||
      HEADER_SIZE + length > file.size
    ) {
      throw new Error(
        '引き継ぎファイルが途中で切れています'
      );
    }

    const metadata = file.slice(
      HEADER_SIZE,
      HEADER_SIZE + length
    );

    if (
      !sameBytes(
        await digest(metadata),
        header.slice(12)
      )
    ) {
      throw new Error('記録データが破損しています');
    }

    let manifest;

    try {
      manifest = JSON.parse(await metadata.text());
    } catch {
      throw new Error(
        '記録データを読み込めませんでした'
      );
    }

    if (
      manifest?.format !== 'sakukatu46-backup' ||
      manifest.version !== 1 ||
      !Array.isArray(manifest.images) ||
      manifest.images.length > 50000
    ) {
      throw new Error('未対応の引き継ぎ形式です');
    }

    validateData(manifest.data);

    if (
      Object.hasOwn(manifest.data, '__photoDatabase')
    ) {
      throw new Error(
        '読み込めない保存先情報が含まれています'
      );
    }

    const images = [];
    const keys = new Set();

    let offset = HEADER_SIZE + length;

    for (
      let index = 0;
      index < manifest.images.length;
      index++
    ) {
      const entry = manifest.images[index];

      if (
        !entry ||
        typeof entry.key !== 'string' ||
        !entry.key ||
        entry.key.length > 2048 ||
        keys.has(entry.key) ||
        !Number.isSafeInteger(entry.size) ||
        entry.size <= 0 ||
        typeof entry.type !== 'string' ||
        entry.type.length > 200 ||
        !/^[0-9a-f]{64}$/.test(entry.sha256 || '') ||
        offset + entry.size > file.size
      ) {
        throw new Error('画像一覧が破損しています');
      }

      keys.add(entry.key);

      const blob = file.slice(
        offset,
        offset + entry.size,
        entry.type
      );

      if (
        hex(await digest(blob)) !== entry.sha256
      ) {
        throw new Error(
          '写真データが破損しています。元のファイルを保存し直してください'
        );
      }

      images.push({
        key: entry.key,
        blob
      });

      offset += entry.size;

      progress(
        onProgress,
        'inspect',
        index + 1,
        manifest.images.length
      );
    }

    if (offset !== file.size) {
      throw new Error(
        'ファイルの長さが正しくありません'
      );
    }

    return {
      data: manifest.data,
      images,
      createdAt: manifest.createdAt,
      size: file.size
    };
  }

  function withTimeout(
    promise,
    milliseconds,
    message
  ) {
    let timer;

    return Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(message));
        }, milliseconds);
      })
    ]).finally(() => clearTimeout(timer));
  }

  function deleteDatabase(name) {
    try {
      const request = indexedDB.deleteDatabase(name);

      request.onerror = () => {};
    } catch {}
  }

  async function restoreFile(file, onProgress) {
    const run = async () => {
      const previous = localStorage.getItem(KEY);
      const parsed = await inspect(file, onProgress);

      progress(
        onProgress,
        'capacity',
        0,
        parsed.images.length
      );

      const estimate = await withTimeout(
        Promise.resolve().then(
          () => navigator.storage?.estimate?.()
        ),
        3000,
        '容量確認が応答しませんでした'
      ).catch(() => null);

      const bytes = parsed.images.reduce(
        (sum, image) => sum + image.blob.size,
        0
      );

      if (
        estimate?.quota &&
        Number.isFinite(estimate.usage) &&
        estimate.quota - estimate.usage <
          bytes + JSON.stringify(parsed.data).length * 2
      ) {
        throw new Error(
          'この端末の空き容量が不足しています。元の記録は変更していません'
        );
      }

      const name =
        `${DEFAULT_DATABASE}-import-${crypto.randomUUID()}`;

      let database;
      let committed = false;
      let abandoned = false;

      try {
        progress(
          onProgress,
          'prepare',
          0,
          parsed.images.length
        );

        const opening = openImages(name).then(
          (result) => {
            if (abandoned) {
              result.close();
              deleteDatabase(name);
            }

            return result;
          }
        );

        database = await withTimeout(
          opening,
          30000,
          '写真の保存先を開けませんでした。ページを再読み込みしてお試しください'
        );

        for (
          let offset = 0;
          offset < parsed.images.length;
          offset += 10
        ) {
          const batch = parsed.images.slice(
            offset,
            offset + 10
          );

          const copies = [];

          for (const image of batch) {
            const buffer = await withTimeout(
              image.blob.arrayBuffer(),
              30000,
              '写真の読み込みが応答しません。ファイルを端末に保存してからお試しください'
            );

            copies.push({
              key: image.key,
              blob: new Blob(
                [buffer],
                { type: image.blob.type }
              )
            });
          }

          await new Promise((resolve, reject) => {
            const transaction = database.transaction(
              STORE,
              'readwrite'
            );

            const timer = setTimeout(() => {
              try {
                transaction.abort();
              } catch {}

              reject(
                new Error(
                  '写真の保存が応答しません。元の記録は変更していません'
                )
              );
            }, 30000);

            transaction.oncomplete = () => {
              clearTimeout(timer);
              resolve();
            };

            transaction.onerror =
              transaction.onabort = () => {
                clearTimeout(timer);

                reject(
                  transaction.error ||
                  new Error(
                    '写真を保存できませんでした。元の記録は変更していません'
                  )
                );
              };

            try {
              const store = transaction.objectStore(STORE);

              for (const image of copies) {
                store.put(image.blob, image.key);
              }
            } catch (error) {
              clearTimeout(timer);

              try {
                transaction.abort();
              } catch {}

              reject(error);
            }
          });

          progress(
            onProgress,
            'save',
            offset + batch.length,
            parsed.images.length
          );
        }

        progress(
          onProgress,
          'commit',
          parsed.images.length,
          parsed.images.length
        );

        if (
          localStorage.getItem(KEY) !== previous
        ) {
          throw new Error(
            '読み込み中に記録が更新されました。もう一度お試しください'
          );
        }

        const next = {
          ...parsed.data,
          __photoDatabase: name
        };

        localStorage.setItem(
          KEY,
          JSON.stringify(next)
        );

        committed = true;

        return {
          images: parsed.images.length,
          database: name
        };
      } finally {
        abandoned = true;
        database?.close();

        if (!committed) {
          deleteDatabase(name);
        }
      }
    };

    if (!navigator.locks?.request) {
      return run();
    }

    return navigator.locks.request(
      'sakukatu46-restore',
      { ifAvailable: true },
      (lock) => {
        if (!lock) {
          throw new Error(
            '別のタブで引き継ぎ中です。ほかのタブを閉じてからお試しください'
          );
        }

        return run();
      }
    );
  }

  window.OshiBackup = Object.freeze({
    exportFile,
    inspect,
    restoreFile
  });
})();
