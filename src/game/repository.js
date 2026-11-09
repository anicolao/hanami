import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";
import config from "./firebase-config.json" with { type: "json" };
import { canonicalJson } from "./canonical.js";
import { replay, VERSION } from "./engine.js";
const env = import.meta.env;
export const scope = env.VITE_PREVIEW_ID || "main";
let connection;
export function connect() {
  return (connection ??= (async () => {
    const emulator = env.VITE_USE_FIREBASE_EMULATORS === "true";
    const app = initializeApp(
      emulator
        ? {
            apiKey: "demo-hanami-key",
            projectId: "demo-hanami",
            authDomain: "demo-hanami.firebaseapp.com",
            appId: "1:123:web:hanami",
          }
        : config,
    );
    const auth = getAuth(app),
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        useFetchStreams: false,
      });
    if (emulator) {
      connectAuthEmulator(auth, "http://127.0.0.1:9291", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "127.0.0.1", 8191);
    }
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    return { db, uid: auth.currentUser.uid };
  })().catch((e) => {
    connection = undefined;
    throw e;
  }));
}
export function rootRef(db, table) {
  return doc(db, "previews", scope, "tables", table);
}
export function repository(db, uid, table, onEvents, onError) {
  let events = [],
    closed = false;
  const root = rootRef(db, table),
    key = `hanami:pending:${scope}:${table}:${uid}`;
  const stop = onSnapshot(
    query(collection(root, "events"), orderBy("sequence")),
    { includeMetadataChanges: true },
    (snap) => {
      if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
      try {
        const next = snap.docs.map((d) => d.data());
        replay(next);
        if (next.length >= events.length) {
          events = next;
          onEvents(events);
        }
      } catch (error) {
        onError(error);
      }
    },
    onError,
  );
  async function send(pending) {
    await runTransaction(db, async (tx) => {
      const ack = await tx.get(doc(root, "commands", pending.id));
      if (ack.exists()) {
        const saved = (
          await tx.get(doc(root, "events", String(ack.data().sequence)))
        ).data();
        if (
          saved.actor !== uid ||
          canonicalJson(saved.intent) !== canonicalJson(pending.intent)
        )
          throw Error("This action ID is already in use.");
        return;
      }
      const snap = await tx.get(root),
        revision = snap.data()?.revision || 0;
      if (revision !== pending.expectedRevision)
        throw Error("The table changed. Choose again.");
      // A fresh transaction replay prevents a stale cache from authorizing a write.
      const prefix = events.length <= revision ? [...events] : [];
      const tail = await Promise.all(
        Array.from({ length: revision - prefix.length }, (_, n) =>
          tx.get(doc(root, "events", String(prefix.length + n + 1))),
        ),
      );
      const history = [...prefix, ...tail.map((d) => d.data())];
      const event = {
        version: VERSION,
        id: pending.id,
        actor: uid,
        sequence: revision + 1,
        intent: pending.intent,
      };
      const next = replay([...history, event]);
      tx.set(root, {
        owner: next.host,
        revision: event.sequence,
        controllers: [...new Set(next.players.map((p) => p.controller))],
      });
      tx.set(doc(root, "events", String(event.sequence)), event);
      tx.set(doc(root, "commands", pending.id), {
        actor: uid,
        sequence: event.sequence,
      });
    });
    if (!closed) localStorage.removeItem(key);
  }
  return {
    async append(intent) {
      if (localStorage.getItem(key))
        throw Error("Retry your last action first.");
      const pending = {
        id: crypto.randomUUID(),
        expectedRevision: events.length,
        intent,
      };
      replay([
        ...events,
        {
          version: VERSION,
          id: pending.id,
          sequence: events.length + 1,
          actor: uid,
          intent,
        },
      ]);
      localStorage.setItem(key, JSON.stringify(pending));
      try {
        await send(pending);
      } catch (e) {
        if (e.message === "The table changed. Choose again.")
          localStorage.removeItem(key);
        throw e;
      }
    },
    async retry() {
      const pending = localStorage.getItem(key);
      if (pending) await send(JSON.parse(pending));
    },
    hasPending: () => !!localStorage.getItem(key),
    close() {
      closed = true;
      stop();
    },
  };
}
