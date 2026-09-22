# Firebase setup for Level Pack Creator

The application is implemented locally. Upload index.html, 404.html, cloud-service.js, cloud-ui.js, default-pack.js, builtin-assets.json, builtin-asset-hashes.json, and the asset folders to the GitHub Pages repository. Keep index.html and 404.html identical when changing the application.

## Firebase console changes

1. Authentication > Sign-in method: enable Anonymous. No sign-in screen is shown to visitors.
2. Realtime Database > Rules: add the `levelPackCreator` entry from firebase-database-additions.json INSIDE your existing `rules` object. Preserve every existing sibling. Publish.
3. Storage > Rules: add the match block from firebase-storage-additions.rules INSIDE `match /b/{bucket}/o`. Preserve the existing mst3Levels and profileImages paths. If the Level Pack Creator block was already added, replace only that block rather than duplicating it. Publish.

The read-only check of /levelPackCreator/packs returned HTTP 401 during implementation. The database catalogue rules are not enabled yet. No live uploads or rule deployments were performed.

## Shared project authentication

Anonymous Authentication is project-wide. Existing rules granting access to any `auth != null` also accept anonymous users. Separate paths do not prevent this. Review the existing application's permissions before enabling anonymous sign-in if those resources must exclude anonymous users. This implementation does not change those other rules.

## Behavior

Save asks for a publishing name once (separate from title text), claims a unique lowercase URL slug, uploads custom assets and MMLV files, then publishes a JSON manifest and catalogue record. Built-in assets stay on GitHub Pages. Files matching a built-in asset's content are reused rather than uploaded. Individual uploads are limited to 100 MB. Failed saves leave the editor's unsaved state intact; uploaded files or a claimed name can remain after failure and can be reused on retry.

Anonymous ownership is stored in the visitor's browser. Clearing browser data loses that identity and therefore the ability to overwrite their existing pack. Other visitors can load and edit a pack but cannot overwrite its name. There is no moderation or aggregate upload quota implemented yet.

Title-screen Load Pack lists published packs. Direct links use /LevelPackCreator/pack-name and lock the UI to that pack with editing disabled. GitHub Pages serves 404.html for those paths: the application works, but the HTTP response remains 404 (a static-host limitation). Default asset paths resolve to /LevelPackCreator/ through the document base URL.

Players download remote MMLV files with normal browser downloads. Progress is stored separately per pack. The pack remains editable locally without a Firebase connection; cloud publication and browsing need the Firebase rules and network.

## Tests

node --preserve-symlinks --preserve-symlinks-main tests/cloud-ui.cjs
node --preserve-symlinks --preserve-symlinks-main tests/cloud-service.cjs

Tests cover browser save/load UI, direct-link locking, default-asset reuse, MMLV/custom upload conversion, and duplicate-name ownership using a mocked Firebase backend. They do not claim live Firebase or emulator rule verification.
