import { test, after, before } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { doc, writeBatch, setDoc, getDoc } from "firebase/firestore";
let env;
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
test("authenticated ordered immutable events and command receipts are one atomic write", async () => {
  const db = env.authenticatedContext("alex").firestore(),
    root = doc(db, "previews/rules/tables/ABCDE"),
    event = doc(root, "events/1"),
    ack = doc(root, "commands/c1"),
    batch = writeBatch(db);
  batch.set(root, { owner: "alex", revision: 1, controllers: ["alex"] });
  batch.set(event, {
    version: 1,
    id: "c1",
    actor: "alex",
    sequence: 1,
    intent: { type: "create", name: "Alex" },
  });
  batch.set(ack, { actor: "alex", sequence: 1 });
  await assertSucceeds(batch.commit());
  await assertFails(
    setDoc(root, { owner: "alex", revision: 2, controllers: ["alex"] }),
  );
  await assertFails(setDoc(event, { actor: "alex" }));
  await assertFails(setDoc(ack, { actor: "alex", sequence: 2 }));
  await assertFails(
    setDoc(doc(root, "events/2"), {
      version: 1,
      id: "c2",
      actor: "alex",
      sequence: 2,
      intent: { type: "join", name: "X" },
    }),
  );
  const outsider = env.authenticatedContext("bea").firestore();
  await assertFails(
    setDoc(doc(outsider, "previews/rules/tables/ABCDE/events/2"), {
      version: 1,
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
        "previews/rules/tables/ABCDE/events/1",
      ),
    ),
  );
});
