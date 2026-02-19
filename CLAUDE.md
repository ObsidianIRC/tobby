
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## Testing

Tests use **vitest**, not bun:test. Import from `vitest` and run with `bun run test`.

```ts
import { test, expect } from 'vitest'

test('example', () => {
  expect(1).toBe(1)
})
```

## Project structure

- Entry point: `src/index.tsx`
- Zustand store slices: `src/store/slices/`
- Actions (Ctrl+K menu): `src/actions/`
- IRC event handlers: `src/store/slices/ircSlice.ts`
- Custom TCP IRC client: `src/utils/ircClient.ts`

## Git submodule

The IRC base library (`ObsidianIRC/`) is a git submodule aliased as `@irc/*`. After cloning:

```sh
git submodule update --init
```

## SASL

SASL PLAIN/EXTERNAL is wired in `ircSlice.ts` via `CAP ACK` and `AUTHENTICATE` event handlers on the IRC client.

## opentui input quirk

`set value()` on `InputRenderable` fires `onInput`, which creates an infinite loop for controlled inputs. For password / secret fields: use a ref and call `setText()` directly instead of setting `value`. See `FormModal.tsx` and `src/utils/formMasking.ts`.

## npm distribution

- Package name: `tobby`
- Bin shim: `bin/tobby.js` (Node ESM, delegates to `bun dist/index.js`)
- Always run `bun run build` before publishing — this bundles everything including the submodule into `dist/index.js`
