import { describe, test } from 'bdd';

// TODO
describe('handleSessioning', () => {
  test(`a session is present on the ctx after the middleware runs`, async () => {});

  describe('no session on request', () => {
    test(`a new session is generated and appears on the set-cookie header of the response`, async () => {});
  });

  describe('session on request', () => {
    test(`the session appears on the set-cookie header of the response`, async () => {});
    test(`the session and its data appears on the ctx`, async () => {});
    describe('refreshing', () => {
      describe('enabled', () => {
        test(`refreshable session is refreshed and appears on the set-cookie header of the response`, async () => {});
        test(`a session beyond the refresh window is not refreshed. A new session is generated appears on the set-cookie header of the response`, async () => {});
      });
      describe('disabled', () => {
        test(`the session's exp is unchanged and appears on the set-cookie header of the response`, async () => {});
      });
    });
  });

  describe('expired session on request', () => {
    describe('refreshing', () => {
      describe('enabled', () => {
        test(`refreshable session is preserved and appears on the set-cookie header of the response`, async () => {});
      });
      describe('disabled', () => {
        test(`a new session is generated and appears on the set-cookie header of the response`, async () => {});
      });
    });
  });

  describe('non-existent session on request', () => {
    test(`a new session is generated and is present on the set-cookie header of the response`, async () => {});
  });

  describe('onReceivedInvalidSessionId', () => {
    test(`invoked when a session is invalid`, async () => {});
    test(`not invoked when a session is valid`, async () => {});
    test(`not invoked when the session is absent`, async () => {});
  });
});
