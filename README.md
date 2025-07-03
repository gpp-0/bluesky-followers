# gpp's Mutual Follow Viewer Thing for Bluesky

Simple browser app for viewing follows/followers shared between any two users.

Enter the handle of each user, and then select one of the following modes:

- Mutual followers → accounts following both users
- Mutual follows → accounts followed by both users
- Known followers aka "Followed by" → what user A would see in the "followed by" section if they looked at B's profile, i.e. users who A follows, and who follow B (protip: if A = B this gives you the users A is mutuals with)

Uses the public Bluesky API, so no authorization is required.

## How to run

Just download the files from Releases and open index.html in a browser.

Alternatively you can build the source code yourself:

1. You will need to have `pnpm` installed.
2. Run `pnpm i`
3. Run `pnpm build && cp ./public/* ./dist`
4. Open `./dist/index.html`

## Warning

There is an upper limit of 10.000 records requested per user, so if you're submitting users with more than that you will probably miss some from the result set. You can change this limit by changing `LIMIT_TOTAL` in `index.ts`, or you can remove it entirely by setting it to null
