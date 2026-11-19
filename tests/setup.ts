import { fakeBrowser } from 'wxt/testing/fake-browser';

// Code under test uses the `chrome` global; back it with WXT's in-memory fake.
(globalThis as unknown as { chrome: typeof fakeBrowser }).chrome = fakeBrowser;

beforeEach(() => {
  fakeBrowser.reset();
});

// fake-browser does not implement getManifest.
fakeBrowser.runtime.getManifest = () =>
  ({ manifest_version: 3, name: 'test', version: '0.0.0-test' }) as ReturnType<
    typeof fakeBrowser.runtime.getManifest
  >;
