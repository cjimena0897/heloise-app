// Acceso a Firebase (Auth + Firestore). Se carga bajo demanda para no pesar en modo local.
import { firebaseConfig } from './firebaseConfig.js';

// Solo para pruebas locales: VITE_FIREBASE_EMULATOR=1 usa los emuladores de Firebase.
const EMULATOR = !!import.meta.env.VITE_FIREBASE_EMULATOR;
const config = EMULATOR ? { apiKey: 'demo', authDomain: 'localhost', projectId: 'demo-ajvc' } : firebaseConfig;

export const CLOUD = EMULATOR || !!firebaseConfig?.apiKey;

let api = null;

async function load() {
  if (api) return api;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore'),
    import('firebase/auth'),
  ]);
  const app = initializeApp(config);
  let db;
  try {
    // Caché persistente: la app sigue funcionando sin internet y sincroniza al volver.
    db = fs.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const auth = au.getAuth(app);
  if (EMULATOR) {
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  api = { db, auth, fs, au };
  return api;
}

export async function watchAuth(cb) {
  const { auth, au } = await load();
  return au.onAuthStateChanged(auth, cb);
}

export async function login(email, password) {
  const { auth, au } = await load();
  await au.signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function logout() {
  const { auth, au } = await load();
  await au.signOut(auth);
}

export async function resetPassword(email) {
  const { auth, au } = await load();
  await au.sendPasswordResetEmail(auth, email.trim());
}

/** Escucha colecciones completas. onData(col, docs, { pending, fromCache }) */
export async function subscribe(cols, onData, onError) {
  const { db, fs } = await load();
  const unsubs = cols.map((col) =>
    fs.onSnapshot(
      fs.collection(db, col),
      { includeMetadataChanges: true },
      (snap) =>
        onData(
          col,
          snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          { pending: snap.metadata.hasPendingWrites, fromCache: snap.metadata.fromCache }
        ),
      onError
    )
  );
  return () => unsubs.forEach((u) => u());
}

/**
 * Aplica operaciones en lotes atómicos.
 * op: { t: 'set' | 'update' | 'del', col, id, data?, inc?, add?, remove? }
 * inc/add/remove usan increment/arrayUnion/arrayRemove para que dos vendedoras
 * a la vez no se pisen el stock ni los pagos.
 */
export function commitCloud(ops) {
  const { db, fs } = api;
  const chunks = [];
  for (let i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
  return Promise.all(
    chunks.map((chunk) => {
      const b = fs.writeBatch(db);
      for (const op of chunk) {
        const ref = fs.doc(db, op.col, op.id);
        if (op.t === 'set') b.set(ref, op.data);
        else if (op.t === 'del') b.delete(ref);
        else {
          const data = { ...(op.data || {}) };
          for (const [k, v] of Object.entries(op.inc || {})) data[k] = fs.increment(v);
          for (const [k, v] of Object.entries(op.add || {})) data[k] = fs.arrayUnion(v);
          for (const [k, v] of Object.entries(op.remove || {})) data[k] = fs.arrayRemove(v);
          b.update(ref, data);
        }
      }
      return b.commit();
    })
  );
}
