import type { StoredConversation } from '../types';

const DB_NAME = 'missed_local_storage_db';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('importedAt', 'importedAt', { unique: false });
        store.createIndex('fileHash', 'fileHash', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open database'));
  });
}

/**
 * Save a confirmed parsed conversation into IndexedDB
 */
export async function saveConversation(convo: StoredConversation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(convo);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to save conversation'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Load all stored conversations (ordered by importedAt descending)
 */
export async function getAllConversations(): Promise<StoredConversation[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = (request.result || []) as StoredConversation[];
        results.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
        resolve(results);
      };
      request.onerror = () => reject(request.error || new Error('Failed to fetch conversations'));
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('Error fetching conversations from IndexedDB:', err);
    return [];
  }
}

/**
 * Delete a specific conversation by ID
 */
export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Failed to delete conversation'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Check if an identical conversation hash already exists (Deduplication)
 */
export async function findDuplicateConversation(fileHash: string): Promise<StoredConversation | null> {
  if (!fileHash) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('fileHash');
      const request = index.get(fileHash);

      request.onsuccess = () => resolve((request.result as StoredConversation) || null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Clear all conversations from IndexedDB
 */
export async function clearAllConversations(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to clear conversations'));
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('Failed to clear IndexedDB conversations:', err);
  }
}
