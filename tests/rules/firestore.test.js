import { randomUUID } from "node:crypto";
import { test, after, before } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, writeBatch, setDoc, getDoc } from "firebase/firestore";
let env;
const scope = `rules-${randomUUID()}`;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hanami",
    firestore: {
      host: "127.0.0.1",
      port: 8191,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
after(async () => env?.cleanup());
for (const version of [1, 2, 3, 99]) test(`authenticated immutable events: protocol ${version}`, async () => {
  const rootPath = `previews/${scope}/tables/ABCDE${version}`;
  const db = env.authenticatedContext("alex").firestore(),
    root = doc(db, rootPath),
    event = doc(root, "events/1"),
    ack = doc(root, "commands/c1"),
    batch = writeBatch(db);
  batch.set(root, { owner: "alex", revision: 1, controllers: ["alex"] });
  batch.set(event, {
    version,
    id: "c1",
    actor: "alex",
    sequence: 1,
    intent: { type: "create", name: "Alex" },
  });
  batch.set(ack, { actor: "alex", sequence: 1 });
  if (version === 99) { await assertFails(batch.commit()); return; }
  await assertSucceeds(batch.commit());
  await assertFails(
    setDoc(root, { owner: "alex", revision: 2, controllers: ["alex"] }),
  );
  await assertFails(setDoc(event, { actor: "alex" }));
  await assertFails(setDoc(ack, { actor: "alex", sequence: 2 }));
  await assertFails(
    setDoc(doc(root, "events/2"), {
      version,
      id: "c2",
      actor: "alex",
      sequence: 2,
      intent: { type: "join", name: "X" },
    }),
  );
  const outsider = env.authenticatedContext("bea").firestore();
  await assertFails(
    setDoc(doc(outsider, `${rootPath}/events/2`), {
      version,
      id: "c2",
      actor: "alex",
      sequence: 2,
      intent: { type: "join", name: "Bea" },
    }),
  );
  await assertFails(
    getDoc(
      doc(
        env.unauthenticatedContext().firestore(),
        `${rootPath}/events/1`,
      ),
    ),
  );
});
