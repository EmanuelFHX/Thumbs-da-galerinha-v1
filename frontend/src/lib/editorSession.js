const DATABASE_NAME = 'thumbs-da-galerinha'
const DATABASE_VERSION = 1
const STORE_NAME = 'editor-sessions'
const SESSION_KEY = 'local-prototype'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

function runTransaction(mode, action) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  }))
}

export function loadEditorSession() {
  return runTransaction('readonly', (store) => store.get(SESSION_KEY))
}

export async function saveEditorSession(session) {
  const savedAt = new Date().toISOString()
  await runTransaction('readwrite', (store) => store.put({
    ...session,
    id: SESSION_KEY,
    schemaVersion: 1,
    savedAt,
  }))
  return savedAt
}

export function clearEditorSession() {
  return runTransaction('readwrite', (store) => store.delete(SESSION_KEY))
}
