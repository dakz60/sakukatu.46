'use strict';

const DB_NAME = 'sakurazaka-oshi-note-photos';
const STORE_NAME = 'photos';
const PHOTO_MAX_SIZE = 1200;
const PHOTO_QUALITY = 0.8;

let databasePromise;

const urls = new Map();

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        const database = request.result;

        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };

        resolve(database);
      };

      request.onerror = () => {
        reject(
          request.error || new Error('画像保存先を開けませんでした')
        );
      };
    }).catch((error) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

async function compressPhoto(file) {
  const temporaryURL = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => {
        reject(
          new Error(
            '画像を読み込めませんでした。JPEG・PNG・WebP画像で試してください'
          )
        );
      };

      image.src = temporaryURL;
    });

    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    if (!originalWidth || !originalHeight) {
      throw new Error('画像のサイズを取得できませんでした');
    }

    const scale = Math.min(
      1,
      PHOTO_MAX_SIZE / Math.max(originalWidth, originalHeight)
    );

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(originalWidth * scale));
    canvas.height = Math.max(1, Math.round(originalHeight * scale));

    try {
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('画像の変換処理を開始できませんでした');
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const compressed = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size) {
              resolve(blob);
            } else {
              reject(new Error('画像を圧縮できませんでした'));
            }
          },
          'image/webp',
          PHOTO_QUALITY
        );
      });

      return compressed.size < file.size ? compressed : file;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(temporaryURL);
  }
}

function clearPhotoURL(id) {
  const key = String(id);
  const url = urls.get(key);

  if (url) {
    URL.revokeObjectURL(url);
  }

  urls.delete(key);
}

async function savePhoto(id, file, options = {}) {
  try {
    if (!(file instanceof Blob) || !file.size) {
      throw new Error('画像ファイルが空か、読み込めませんでした');
    }

    const key = String(id);
    const shouldCompress =
      options.compress ?? key.startsWith('goods-image-');

    const image = shouldCompress ? await compressPhoto(file) : file;

    const database = await openDatabase();

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = transaction.onabort = () => {
        reject(
          transaction.error ||
            new Error('画像の保存処理が中断されました')
        );
      };

      transaction.objectStore(STORE_NAME).put(image, key);
    });

    clearPhotoURL(key);
  } catch (error) {
    console.error('画像の保存に失敗しました', error);
    throw error;
  }
}

async function getPhotoURL(id) {
  const key = String(id);

  if (urls.has(key)) {
    return urls.get(key);
  }

  const database = await openDatabase();

  const file = await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');

    const request = transaction.objectStore(STORE_NAME).get(key);
    let result;

    request.onsuccess = () => {
      result = request.result;
    };

    transaction.oncomplete = () => {
      resolve(result);
    };

    transaction.onerror = transaction.onabort = () => {
      reject(
        transaction.error ||
          request.error ||
          new Error('画像を読み込めませんでした')
      );
    };
  });

  if (!file) {
    return '';
  }

  if (!(file instanceof Blob)) {
    throw new Error('保存されている画像の形式が正しくありません');
  }

  if (urls.has(key)) {
    return urls.get(key);
  }

  const url = URL.createObjectURL(file);
  urls.set(key, url);

  return url;
}

async function deletePhoto(id) {
  const key = String(id);
  const database = await openDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = transaction.onabort = () => {
      reject(
        transaction.error ||
          new Error('画像の削除処理が中断されました')
      );
    };

    transaction.objectStore(STORE_NAME).delete(key);
  });

  clearPhotoURL(key);
}
