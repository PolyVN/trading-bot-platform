---
name: check
description: Review all uncommitted code changes and auto-fix issues
---

Review all uncommitted code changes (since the last commit). Steps:

1. Run `git diff` and `git diff --staged` to identify all changed files
2. If there are no changes, report "Nothing to review" and stop
3. For each changed file, check for:
   - Logic errors, bugs, or typos
   - Security issues (hardcoded secrets, injection, XSS, etc.)
   - Inconsistencies with project conventions in CLAUDE.md
   - Missing error handling where needed
   - Incorrect types or naming conventions
4. If any issues are found, fix them immediately without asking
5. After review, provide a brief summary of what was reviewed and any fixes applied
