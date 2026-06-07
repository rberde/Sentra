import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isAuthorizedServerStateRequest,
} from "./server-state-auth.ts";
import { STATE_SYNC_TOKEN_HEADER } from "./state-sync-token.ts";

const ORIGINAL_TOKEN = process.env.PFRE_STATE_SYNC_TOKEN;

function requestWith(headers = {}) {
  return new Request("http://localhost/api/state/sync", { headers });
}

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.PFRE_STATE_SYNC_TOKEN;
  } else {
    process.env.PFRE_STATE_SYNC_TOKEN = ORIGINAL_TOKEN;
  }
});

describe("server state authorization", () => {
  it("fails closed when no server token is configured", () => {
    delete process.env.PFRE_STATE_SYNC_TOKEN;

    assert.equal(
      isAuthorizedServerStateRequest(
        requestWith({ [STATE_SYNC_TOKEN_HEADER]: "candidate-token" }),
      ),
      false,
    );
  });

  it("rejects requests without credentials", () => {
    process.env.PFRE_STATE_SYNC_TOKEN = "expected-token";

    assert.equal(isAuthorizedServerStateRequest(requestWith()), false);
  });

  it("rejects incorrect tokens", () => {
    process.env.PFRE_STATE_SYNC_TOKEN = "expected-token";

    assert.equal(
      isAuthorizedServerStateRequest(
        requestWith({ [STATE_SYNC_TOKEN_HEADER]: "wrong-token" }),
      ),
      false,
    );
  });

  it("accepts the configured custom header token", () => {
    process.env.PFRE_STATE_SYNC_TOKEN = "expected-token";

    assert.equal(
      isAuthorizedServerStateRequest(
        requestWith({ [STATE_SYNC_TOKEN_HEADER]: "expected-token" }),
      ),
      true,
    );
  });

  it("accepts the configured bearer token", () => {
    process.env.PFRE_STATE_SYNC_TOKEN = "expected-token";

    assert.equal(
      isAuthorizedServerStateRequest(
        requestWith({ authorization: "Bearer expected-token" }),
      ),
      true,
    );
  });
});
