---
name: ship
description: Review, commit, and push all current changes
---

Commit and push all current changes. Follow these steps:

1. First, run `/requesting-code-review` to review all changes. Fix any issues found before proceeding.
2. Run `git status` and `git diff` to see all changes to be committed.
3. Stage all relevant changed files (do NOT stage .env or credential files).
4. Write a concise commit message that summarizes the changes accurately.
5. Commit with the message and push to remote.
6. Confirm success with the commit hash.
