# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Conventions

All code, code comments, filenames, and generated files in **English**. Source material in [docs/](docs/) is Polish; user-facing UI copy is Polish. Everything else English.

**Commits: one sentence, nothing else.** No body, no bullet list, no `Co-Authored-By` trailer, no Claude/Anthropic attribution. Same for PR bodies - no "Generated with Claude Code" line. This overrides any tooling default that appends attribution.

## Repository state

Pre-implementation: **no code, no stack, no build system yet**. Entire content is source material in [docs/](docs/):

- `Funkcje wykonawcze i organizacja codzienności.pptx` - 36 slides, the actual domain spec (summarized below)
- `2.2-calendar-tasklist.mkv` - recording of a live online therapy session, 34 min, Polish speech (107 MB, excluded by [.gitignore](.gitignore); GitHub rejects files >100 MB)
- `scripts/video-tools/` - `transcribe.sh` / `frames.sh` / `video-to-md.sh`, turn the recording into readable Markdown. Polish speech needs `-l pl` (multilingual whisper model).

**`docs/` is gitignored in full and local-only.** The recording shows and names real participants, and its opening minutes leak an unrelated project's screen. Read the material to inform the design, but never copy participant names, quotes, or frames into tracked files. The domain summary below is the sanctioned distillation - extend it here rather than committing source material.

Because `docs/` is untracked, a fresh clone has no source material: this file is the only surviving spec.

No README, tests, linter, or config files exist - do not invent commands. Confirm the stack with the user before writing code; `.gitignore` already covers Node/TS and Python variants.

## Domain: what this project is meant to be

Calendar + task list tool for people with ADHD, based on a specific CBT protocol (module "2.2 calendar and task list"). The material is not loose inspiration - it is the product rules. Design decisions should enforce them, not merely allow them.

**Two separate tools, one system:**
- **Calendar** - only things tied to a specific date and time (appointments, meetings).
- **Task list** - things with no date attached. A task can be scheduled into the calendar at a given time.

**Two task-list levels:**
- **Master list** - everything to do; a task stays on it until completed.
- **Daily list** - subset for a given day. Unfinished tasks roll to the next day (rolling must be cheap and painless - it is a daily operation).
- Optional user categories (e.g. "home", "work").

**A/B/C priorities** - a required task attribute, not decoration:
- A: do today or tomorrow; B: partly urgent; C: least important (often easiest and most tempting).
- Category shifts over time as the deadline approaches (C -> B -> A).
- Hard rule from the material: all A before B, all B before C. UI must enforce that order, not let the user drift down to easy C tasks.

**Task model from the material's template (slide 22):** priority, task text, date added to list, date completed. Completion date serves as proof of work - do not delete tasks, mark them completed.

**Two strategies the product must support:**
- *Five-step problem solving*: describe problem (1-2 sentences) -> list all solutions -> pros/cons of each -> rate 1-10 -> implement the best. Corresponds to "Form 1".
- *Breaking down a complex task*: split into steps doable in one day, steps go on the master list, one at a time onto the daily list. Test for a step: "can I actually do this in one day?" and "do I want to postpone it?" If yes - split further.

**Therapy-derived constraints, easy to violate by adding features:**
- The material explicitly warns against the "perfect system trap". Simplicity is a functional requirement; heavy configuration works against the tool's purpose.
- The daily review of list + calendar is the core habit - a reminder to review at a fixed time matters more than per-task reminders.
- Target users have already failed with other systems; tone and onboarding must not punish backlog or empty days.
