/**
 * Unit tests for pasteImageAttachmentActor.
 *
 * The clipboard reader is injected via PasteImageAttachmentInput.readImage, so
 * these tests are deterministic and never touch the real OS clipboard (which
 * previously made the machine-level test flaky when an image was present).
 */
import { assertRejects, assertStringIncludes } from "@std/assert";
import { createActor, toPromise } from "xstate";
import { pasteImageAttachmentActor } from "./editing.actors.ts";
import { MockTaskClient } from "../../mock_client.ts";
import { MAX_ATTACHMENT_SIZE } from "../../../shared/limits.ts";

Deno.test("pasteImageAttachmentActor - no clipboard image rejects", async () => {
  const actor = createActor(pasteImageAttachmentActor, {
    input: {
      client: new MockTaskClient(),
      taskId: 1,
      readImage: () => Promise.resolve(null),
    },
  });
  const done = toPromise(actor);
  actor.start();
  await assertRejects(() => done, Error, "No image on clipboard");
});

Deno.test("pasteImageAttachmentActor - oversized image rejects", async () => {
  const tooBig = new Uint8Array(MAX_ATTACHMENT_SIZE + 1);
  const actor = createActor(pasteImageAttachmentActor, {
    input: {
      client: new MockTaskClient(),
      taskId: 1,
      readImage: () => Promise.resolve(tooBig),
    },
  });
  const done = toPromise(actor);
  actor.start();
  const error = await assertRejects(() => done, Error);
  assertStringIncludes(error.message, "exceeds");
});
