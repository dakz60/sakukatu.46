'use strict';

const DB_NAME = 'sakurazaka-oshi-note-photos';
const STORE_NAME = 'photos';

let databasePromise;

const urls = new Map();

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
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
        databasePromise = undefined;
        reject(request.error);
      };
    });
  }

  return databasePromise;
}

async function savePhoto(id, file) {
  const database = await openDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');

    transaction.objectStore(STORE_NAME).put(file, String(id));
    transaction.oncomplete = resolve;

    transaction.onerror = transaction.onabort = () => {
      reject(
        transaction.error || new Error('画像の保存処理が中断されました')
      );
    };
  });

  const key = String(id);
  const oldURL = urls.get(key);

  if (oldURL) {
    URL.revokeObjectURL(oldURL);
  }

  urls.delete(key);
}

async function getPhotoURL(id) {
  const key = String(id);

  if (urls.has(key)) {
    return urls.get(key);
  }

  const database = await openDatabase();

  const file = await new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME)
      .objectStore(STORE_NAME)
      .get(key);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  if (!file) {
    return '';
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
  const oldURL = urls.get(key);

  if (oldURL) {
    URL.revokeObjectURL(oldURL);
  }

  urls.delete(key);

  const database = await openDatabase();

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');

    transaction.objectStore(STORE_NAME).delete(key);
    transaction.oncomplete = resolve;

    transaction.onerror = transaction.onabort = () => {
      reject(
        transaction.error || new Error('画像の削除処理が中断されました')
      );
    };
  });
}
