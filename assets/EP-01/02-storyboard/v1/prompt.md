# prompt.md — EP-01 / 02-storyboard / v1

## Task
Convert approved EP-01 step-01 English narration (6 beats) into a scene map + shot list for vertical narrated short drama.

## Rules
- Follow `docs/CONTENT-SCHEMA-01-02.md` §2.
- Every beat `b1`–`b6` must have ≥1 shot via `linked_beat_id`.
- Each shot must specify: characters, action, scene, evidence_visual (concrete, generatable).
- Preserve key dialogues on the matching shots (b1 James; b3 Serena×2; b6 VO vow).
- Do not invent new plot; visual-only elaboration of `visual_hint` from 01.
- Aspect draft 9:16; leave duration/resolution open.
- Character names: Serena Harris, James Miller, Amy, Kate.

## Input
- `assets/EP-01/01-script/v1/output.json` (approved)

## Output
- `output.json` + human-readable `output.md` shot table
