# Git Workflow & Husky Guide

This project uses **Husky** to enforce code quality and standard commit messages. Follow this guide to successfully push your changes.

## Step-by-Step Workflow

### 1. Stage Your Changes

Add the files you want to commit to the staging area.

```bash
git add .
# OR specific files
git add src/users/users.service.ts
```

### 2. Commit Your Changes

When you run `git commit`, two things happen:

1.  **Pre-commit Hook**: `lint-staged` runs. It will automatically format and lint your staged files (using ESLint and Prettier). If there are errors you need to fix, the commit will fail.
2.  **Commit-msg Hook**: Your commit message is checked against the **Conventional Commits** standard.

**✅ Correct Usage:**

```bash
git commit -m "feat: add new login api"
```

**❌ Incorrect Usage (Will Fail):**

```bash
git commit -m "added login"
# Error: type must be one of [feat, fix, chore...]
```

### 3. Push to Remote

When you run `git push`, the **Pre-push Hook** runs.

1.  It runs **Type Checking** (`tsc --noEmit`) to catch any TypeScript errors.
2.  It runs the **Build Process** (`npm run build`) to ensure the application builds successfully.
3.  If either fails, the push is **aborted**.

```bash
git push origin master
```

---

## Branch Naming Convention

We use **Husky's pre-commit hook** to enforce strict branch naming conventions. Your branch name must follow the pattern `<type>/<description>`.

**Types allowed:** `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`.

**✅ Valid Names:**

- `feat/add-new-login-api`
- `fix/resolve-crash-when-email-null`
- `chore/update-dependencies`

**❌ Invalid Names (Will fail to commit):**

- `update-readme`
- `feature/add-login`
- `my-new-branch`

_(Note: core branches like `main`, `master`, and `develop` are excluded from this rule)._

---

## Commit Message Keywords (Types)

We follow the **Conventional Commits** specification. Your message must start with one of these keywords followed by a colon and a space.

| Keyword        | Meaning                                                                           | Example                                      |
| :------------- | :-------------------------------------------------------------------------------- | :------------------------------------------- |
| **`feat`**     | A new feature                                                                     | `feat: add user registration endpoint`       |
| **`fix`**      | A bug fix                                                                         | `fix: resolve crash when email is null`      |
| **`chore`**    | Maintenance tasks (no code change)                                                | `chore: update dependencies`                 |
| **`refactor`** | Code change that neither fixes a bug nor adds a feature                           | `refactor: simplify auth service logic`      |
| **`docs`**     | Documentation only changes                                                        | `docs: update API readme`                    |
| **`style`**    | Changes that do not affect the meaning of the code (white-space, formatting, etc) | `style: fix indentation in users controller` |
| **`test`**     | Adding missing tests or correcting existing tests                                 | `test: add unit tests for user service`      |
| **`build`**    | Changes that affect the build system or external dependencies                     | `build: upgrade typescript to v5`            |
| **`ci`**       | Changes to our CI configuration files and scripts                                 | `ci: add github actions pipeline`            |
| **`perf`**     | A code change that improves performance                                           | `perf: optimize image loading speed`         |
| **`revert`**   | Reverts a previous commit                                                         | `revert: feat: add google login`             |

### Format Structure

```text
<type>: <subject>

[optional body]

[optional footer(s)]
```

_Example with body:_

```text
feat: add password hashing

Used argon2 for secure password hashing on the registration route.
Breaking change: old plain text passwords will no longer work.
```

---

## ⚠️ Common Errors

### "subject may not be empty" / "type may not be empty"

This usually means you **forgot the space** after the colon.

**❌ Wrong:** `feat:new login`
**✅ Right:** `feat: new login`
