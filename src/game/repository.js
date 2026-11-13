import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, signOut, connectAuthEmulator } from "firebase/auth";
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
import { sameCommand } from "./canonical.js";
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
    // Emulator accounts disappear when emulators restart, but browser sessions
    // persist. Validate before Firestore silently falls back to offline mode.
    if (emulator && auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(true);
      } catch (error) {
        if (!["auth/invalid-refresh-token", "auth/user-token-expired", "auth/user-not-found", "auth/invalid-user-token", "auth/user-disabled"].includes(error.code)) throw error;
        await signOut(auth);
      }
    }
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
  async function readHistory(tx, revision) {
    const prefix = events.length <= revision ? [...events] : [];
    const tail = await Promise.all(
      Array.from({ length: revision - prefix.length }, (_, n) =>
        tx.get(doc(root, "events", String(prefix.length + n + 1))),
      ),
    );
    return [...prefix, ...tail.map((d) => d.data())];
  }
  async function send(pending) {
    const committed = await runTransaction(db, async (tx) => {
      const ack = await tx.get(doc(root, "commands", pending.id));
      if (ack.exists()) {
        const saved = (
          await tx.get(doc(root, "events", String(ack.data().sequence)))
        ).data();
        if (!sameCommand(saved, uid, pending))
          throw Error("This action ID is already in use.");
        return saved.sequence <= events.length ? null : readHistory(tx, saved.sequence);
      }
      const snap = await tx.get(root),
        revision = snap.data()?.revision || 0;
      if (revision !== pending.expectedRevision)
        throw Error("The table changed. Choose again.");
      // A fresh transaction replay prevents a stale cache from authorizing a write.
      const history = await readHistory(tx, revision);
      const event = {
        version: pending.version ?? 1,
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
      return [...history, event];
    });
    if (!closed) {
      localStorage.removeItem(key);
      // The write acknowledgement can arrive before the listener. Publish only
      // committed events, before callers can make another choice with an old
      // prefix. A later listener echo is already deduplicated by its revision.
      if (committed && committed.length > events.length) {
        replay(committed);
        events = committed;
        onEvents(events);
      }
    }
  }
  return {
    async append(intent) {
      if (localStorage.getItem(key))
        throw Error("Retry your last action first.");
      const pending = {
        version: VERSION,
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
      if (pending) {
        try { await send(JSON.parse(pending)); }
        catch(error) {
          if(error.message === "The table changed. Choose again.")localStorage.removeItem(key);
          throw error;
        }
      }
    },
    hasPending: () => !!localStorage.getItem(key),
    close() {
      closed = true;
      stop();
    },
  };
}
