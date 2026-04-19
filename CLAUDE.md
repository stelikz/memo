# CLAUDE.md

## Project Overview

Memo is a React Native (Expo SDK 54) language-learning app using expo-router, NativeWind, Drizzle ORM, and Supabase.

## TypeScript

- **Skip `npx tsc` during development.** Only run type-checking right before committing.

## Commits

This project uses [commitlint](https://commitlint.js.org/) with `@commitlint/config-conventional`.

### Format

```
<type>(<scope>): <subject>
```

### Types

`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`

### Scopes (common)

`ui`, `components`, `i18n`, `ai`, `db`, `nav`, `config`

### Grouped commits

When committing multiple unrelated changes, **group them into separate commits by scope/type** rather than one large commit. For example:

- `feat(i18n): add locale strings for new screen`
- `feat(ui): add new screen component`
- `fix(db): handle null values in query`

Each commit should be atomic — one logical change per commit.
