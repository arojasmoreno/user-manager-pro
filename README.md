## Overview

This project uses the following tech stack:
- Vite
- Typescript
- React Router v7 (all imports from `react-router` instead of `react-router-dom`)
- React 19 (for frontend components)
- Tailwind v4 (for styling)
- Shadcn UI (for UI components library)
- Lucide Icons (for icons)
- Convex (for backend & database)
- Convex Auth (for authentication)
- Framer Motion (for animations)
- Three js (for 3d models)

All relevant files live in the 'src' directory.

Use bun for the package manager. `bun.lock` is the only lockfile: do not add a
`package-lock.json`. The exact bun version is pinned in `package.json`
(`packageManager`), and CI installs with `bun install --frozen-lockfile`.

## Setup

This project is set up already and running on a cloud environment, as well as a convex development in the sandbox.

### Generated Convex code

`src/convex/_generated/` **is committed** (Convex recommends it and the repo does
not typecheck without it). Regenerate it when you add, rename or remove a
function in `src/convex/`:

```bash
bun run codegen        # node scripts/convex-codegen.mjs
```

The canonical command is `npx convex dev`, but it needs credentials for the
deployment this project points at. `scripts/convex-codegen.mjs` reproduces the
same output offline, using the templates of the installed `convex` package.

### Checks

```bash
bun run typecheck      # tsc -b
bun run lint           # eslint
bun run test           # vitest run
bun run build          # tsc -b && vite build
```

All four run in CI (`.github/workflows/ci.yml`).

### Secret leaks

CI runs a secrets scan on every push and pull request: the dependency-free
`scripts/scan-secrets.mjs` plus [gitleaks](https://github.com/gitleaks/gitleaks)
with the project rules in `.gitleaks.toml` (dotenvx `.env.keys` and
`DOTENV_PRIVATE_KEY`). The scan looks at the working tree, not the history.

To run it locally, and to install the versioned pre-commit hook that blocks
committing a key in the first place:

```bash
bun run secrets:check     # node scripts/scan-secrets.mjs
bun run hooks:install     # git config core.hooksPath .githooks
```

A line that is a false positive can be exempted with `secret-scan:allow`
(`gitleaks:allow` for gitleaks). Never put secret values in tracked files: keep
them in `.env.local` (git-ignored, encrypted with dotenvx), so the private key
only lives in `.env.keys` and in the platform's secret store.

### Local dev with the encrypted `.env.local`

The platform runs `bun run dev` (`vite`) and injects the variables itself, so that
script must stay as it is. To run the app on your own machine the variables have
to be decrypted first, which is what `dev:local` does:

```bash
bun run dev:local      # dotenvx run --strict -f .env.local -- vite
```

It needs `.env.local` (git-ignored) **and** `.env.keys` (the dotenvx private key,
also git-ignored) next to it; neither is in the repository, so copy both from a
checkout that already has them. Never commit either file. `--strict` makes the
script fail with a clear error instead of starting Vite without variables when
either file is missing, so a broken setup cannot be mistaken for a working one.

## Environment Variables

The project is set up with project specific CONVEX_DEPLOYMENT and VITE_CONVEX_URL environment variables on the client side.

The convex server has a separate set of environment variables that are accessible by the convex backend.

Currently, these variables include auth-specific keys: JWKS, JWT_PRIVATE_KEY, and SITE_URL.

### AI (document assistant and sheet translations)

The assistant tab answers questions about the sheet catalogue, and the admin can
translate a sheet's title, product and manufacturer from the sheet's edit
dialog. Both features run on the server (Convex actions) and need **one** of
these two variables in the deployment environment — the first one that is set
wins:

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `GOOGLE_API_KEY` | Google AI Studio key, calls Gemini directly | https://aistudio.google.com/apikey |
| `VLY_INTEGRATION_KEY` | Platform integration key, calls the AI gateway (any model, no extra account) | the project's Keys tab |

Set it in the project's **Keys** tab — with this setup that is the only route that
can work. The deployment the app talks to (`VITE_CONVEX_URL`,
`gallant-ladybug-133`) belongs to the project the hosting platform owns, not to
your own Convex team, so `npx convex env set` answers `You don't have access to
the selected project`. For the same reason
`npx convex dev` and `npx convex deploy` cannot push these functions from a local
checkout — the functions reach the deployment when the platform publishes the
project. (The `CONVEX_DEPLOYMENT` value in `.env.local` is a platform identifier,
so the CLI cannot even resolve it; it expects a deployment name such as
`dev:gallant-ladybug-133`, passed with `--env-file`.)

Everything must be deployed before it takes effect: set the key, then publish
the project so the functions are pushed.

Optional overrides:

- `GOOGLE_MODEL` (default `gemini-3.8-flash`)
- `VLY_AI_MODEL` (default `google/gemini-3.8-flash`)
- `GEMINI_API_KEY` is accepted as an alias of `GOOGLE_API_KEY`

Without any of them the assistant tab stays visible and explains what is
missing instead of failing silently. The translations are stored one row per
sheet and language in the `fichaTranslations` table; what is missing falls back
to the Spanish original.

A live smoke test against the real provider runs only when a key is present in
the local environment:

```bash
GOOGLE_API_KEY=<your-key> npx vitest run src/test/chatbot.live.test.ts
```


# Using Authentication (Important!)

You must follow these conventions when using authentication.

## Auth is already set up.

All convex authentication functions are already set up. The auth currently uses email OTP and anonymous users, but can support more.

The email OTP configuration is defined in `src/convex/auth/emailOtp.ts`. DO NOT MODIFY THIS FILE.

Also, DO NOT MODIFY THESE AUTH FILES: `src/convex/auth.config.ts` and `src/convex/auth.ts`.

## Using Convex Auth on the backend

On the `src/convex/users.ts` file, you can use the `getCurrentUser` function to get the current user's data.

## Using Convex Auth on the frontend

The `/auth` page is already set up to use auth. Navigate to `/auth` for all log in / sign up sequences.

You MUST use this hook to get user data. Never do this yourself without the hook:
```typescript
import { useAuth } from "@/hooks/use-auth";

const { isLoading, isAuthenticated, user, signIn, signOut } = useAuth();
```

## Protected Routes

The starter `/dashboard` route is protected with `RequireAuth`. Extend that page
for the product's authenticated experience, and reuse `RequireAuth` when adding
another protected route — do NOT hand-roll a redirect to `/auth`, since landing
on a bare sign-in form with no explanation of what was blocked is confusing.

`RequireAuth` states the block on the page the visitor asked for and sends them
to `/auth?returnTo=<current route>` when they choose to sign in, so they come
back to it. Pass `title` and `description` to say what the page is:

```tsx
<Route
  path="/dashboard"
  element={
    <RequireAuth
      title="Sign in to view your dashboard"
      description="Your projects and settings live here."
    >
      <Dashboard />
    </RequireAuth>
  }
/>
```

Pass `redirectImmediately` for a route where bouncing straight to `/auth` really
is better.

## Auth Page

The auth page is defined in `src/pages/Auth.tsx`. Send sign-in and sign-up actions
to `/auth`.

## Authorization

You can perform authorization checks on the frontend and backend.

On the frontend, you can use the `useAuth` hook to get the current user's data and authentication state.

You should also be protecting queries, mutations, and actions at the base level, checking for authorization securely.

## Adding a redirect after auth

The `/auth` route in `src/main.tsx` redirects to `/dashboard` by default. If the
product's main authenticated route is different, update `redirectAfterAuth` to
that route. A validated same-origin `returnTo` query parameter takes priority so
users can resume the protected page they originally requested. Never leave an
authenticated product redirecting back to the public landing page.

## Complete authenticated products

When the requested product implies accounts, a workspace, a dashboard, or other
signed-in functionality, the task is not complete with only a landing page and
auth form. Build the main authenticated experience, protect its route, and verify
that signing in reaches it.

# Frontend Conventions

You will be using the Vite frontend with React 19, Tailwind v4, and Shadcn UI.

Generally, pages should be in the `src/pages` folder, and components should be in the `src/components` folder.

Shadcn primitives are located in the `src/components/ui` folder and should be used by default.

## Page routing

Your page component should go under the `src/pages` folder.

When adding a page, update the react router configuration in `src/main.tsx` to include the new route you just added.

## Shad CN conventions

Follow these conventions when using Shad CN components, which you should use by default.
- Remember to use "cursor-pointer" to make the element clickable
- For title text, use the "tracking-tight font-bold" class to make the text more readable
- Always make apps MOBILE RESPONSIVE. This is important
- AVOID NESTED CARDS. Try and not to nest cards, borders, components, etc. Nested cards add clutter and make the app look messy.
- AVOID SHADOWS. Avoid adding any shadows to components. stick with a thin border without the shadow.
- Avoid skeletons; instead, use the loader2 component to show a spinning loading state when loading data.


## Landing Pages

You must always create good-looking designer-level styles to your application. 
- Make it well animated and fit a certain "theme", ie neo brutalist, retro, neumorphism, glass morphism, etc

Use known images and emojis from online.

If the user is logged in already, show the get started button to say "Dashboard" or "Profile" instead to take them there.

## Responsiveness and formatting

Make sure pages are wrapped in a container to prevent the width stretching out on wide screens. Always make sure they are centered aligned and not off-center.

Always make sure that your designs are mobile responsive. Verify the formatting to ensure it has correct max and min widths as well as mobile responsiveness.

- Always create sidebars for protected dashboard pages and navigate between pages
- Always create navbars for landing pages
- On these bars, the created logo should be clickable and redirect to the index page

## Animating with Framer Motion

You must add animations to components using Framer Motion. It is already installed and configured in the project.

To use it, import the `motion` component from `framer-motion` and use it to wrap the component you want to animate.


### Other Items to animate
- Fade in and Fade Out
- Slide in and Slide Out animations
- Rendering animations
- Button clicks and UI elements

Animate for all components, including on landing page and app pages.

## Three JS Graphics

Your app comes with three js by default. You can use it to create 3D graphics for landing pages, games, etc.


## Colors

You can override colors in: `src/index.css`

This uses the oklch color format for tailwind v4.

Always use these color variable names.

Make sure all ui components are set up to be mobile responsive and compatible with both light and dark mode.

Set theme using `dark` or `light` variables at the parent className.

## Styling and Theming

When changing the theme, always change the underlying theme of the shad cn components app-wide under `src/components/ui` and the colors in the index.css file.

Avoid hardcoding in colors unless necessary for a use case, and properly implement themes through the underlying shad cn ui components.

When styling, ensure buttons and clickable items have pointer-click on them (don't by default).

Always follow a set theme style and ensure it is tuned to the user's liking.

## Toasts

You should always use toasts to display results to the user, such as confirmations, results, errors, etc.

Use the shad cn Sonner component as the toaster. For example:

```
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
export function SonnerDemo() {
  return (
    <Button
      variant="outline"
      onClick={() =>
        toast("Event has been created", {
          description: "Sunday, December 03, 2023 at 9:00 AM",
          action: {
            label: "Undo",
            onClick: () => console.log("Undo"),
          },
        })
      }
    >
      Show Toast
    </Button>
  )
}
```

Remember to import { toast } from "sonner". Usage: `toast("Event has been created.")`

## Dialogs

Always ensure your larger dialogs have a scroll in its content to ensure that its content fits the screen size. Make sure that the content is not cut off from the screen.

Ideally, instead of using a new page, use a Dialog instead. 

# Using the Convex backend

You will be implementing the convex backend. Follow your knowledge of convex and the documentation to implement the backend.

## The Convex Schema

You must correctly follow the convex schema implementation.

The schema is defined in `src/convex/schema.ts`.

Do not include the `_id` and `_creationTime` fields in your queries (it is included by default for each table).
Do not index `_creationTime` as it is indexed for you. Never have duplicate indexes.


## Convex Actions: Using CRUD operations

When running anything that involves external connections, you must use a convex action with "use node" at the top of the file.

You cannot have queries or mutations in the same file as a "use node" action file. Thus, you must use pre-built queries and mutations in other files.

You can also use the pre-installed internal crud functions for the database:

```ts
// in convex/users.ts
import { crud } from "convex-helpers/server/crud";
import schema from "./schema.ts";

export const { create, read, update, destroy } = crud(schema, "users");

// in some file, in an action:
const user = await ctx.runQuery(internal.users.read, { id: userId });

await ctx.runMutation(internal.users.update, {
  id: userId,
  patch: {
    status: "inactive",
  },
});
```


## Common Convex Mistakes To Avoid

When using convex, make sure:
- Document IDs are referenced as `_id` field, not `id`.
- Document ID types are referenced as `Id<"TableName">`, not `string`.
- Document object types are referenced as `Doc<"TableName">`.
- Keep schemaValidation to false in the schema file.
- You must correctly type your code so that it passes the type checker.
- You must handle null / undefined cases of your convex queries for both frontend and backend, or else it will throw an error that your data could be null or undefined.
- Always use the `@/folder` path, with `@/convex/folder/file.ts` syntax for importing convex files.
- This includes importing generated files like `@/convex/_generated/server`, `@/convex/_generated/api`
- Remember to import functions like useQuery, useMutation, useAction, etc. from `convex/react`
- NEVER have return type validators.
