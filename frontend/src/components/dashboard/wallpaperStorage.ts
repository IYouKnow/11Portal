const WALLPAPER_DB_NAME = "portal-wallpapers";
const WALLPAPER_STORE_NAME = "wallpapers";

function openWallpaperDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(WALLPAPER_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
        database.createObjectStore(WALLPAPER_STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Could not open wallpaper storage."));
    };
  });
}

export function readWallpaperImage(storageKey: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readonly");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.get(storageKey);

        request.onsuccess = () => {
          resolve(typeof request.result === "string" ? request.result : null);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Could not read wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
        };
      })
      .catch(reject);
  });
}

export function writeWallpaperImage(
  storageKey: string,
  image: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readwrite");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.put(image, storageKey);

        request.onerror = () => {
          reject(request.error ?? new Error("Could not save wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not save wallpaper image."));
        };
      })
      .catch(reject);
  });
}

export function deleteWallpaperImage(storageKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    openWallpaperDatabase()
      .then((database) => {
        const transaction = database.transaction(WALLPAPER_STORE_NAME, "readwrite");
        const store = transaction.objectStore(WALLPAPER_STORE_NAME);
        const request = store.delete(storageKey);

        request.onerror = () => {
          reject(request.error ?? new Error("Could not clear wallpaper image."));
        };
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Could not clear wallpaper image."));
        };
      })
      .catch(reject);
  });
}
