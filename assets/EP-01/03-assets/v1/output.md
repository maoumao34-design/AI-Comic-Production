# EP-01 · Step 03 Consistency Assets · v1 (prompt pack — images pending)

**Source storyboard:** `assets/EP-01/02-storyboard/v1/` (approved 2026-08-04T05:42:18Z)  
**Aspect (draft):** 9:16 vertical · cinematic comic-realism  
**Schema:** `docs/STEP-CONTENT-SCHEMA-03-04-05.md#03`  
**Status:** `draft` — Prompt/packing list ready; **images not yet generated** (blocked on ComfyUI / platform keys). Do not treat as checkpoint-ready until outputs exist.

---

## Packing list (must generate)

### Characters (三视图 front/side/back each)

| subject_id | Type | Notes |
|---|---|---|
| char/serena | character | Hidden heiress; controlled steel; EP01 look A (villa evening) |
| char/james | character | Husband; polished then guilty |
| char/amy | character | Sponsored student; campus casual |
| char/kate | character | Executive assistant; office look (phone split) |

### Expressions / costume states

| subject_id | Type | Linked to |
|---|---|---|
| expr/serena-controlled | expression | S1–S3, S7 |
| expr/serena-steel | expression | S8, S16 |
| expr/serena-alone | expression | S9–S11 |
| costume/serena-villa-evening | costume | sc1/sc3/sc5 |
| costume/amy-campus | costume | sc2 |
| costume/kate-office | costume | sc4 |

### Scenes

| subject_id | Type | Shots |
|---|---|---|
| scene/villa-living | scene | S1–S3, S6–S8 |
| scene/campus | scene | S4 |
| scene/prime-group-skyline | scene | S11 |
| scene/kate-office | scene | S12 |
| scene/villa-window-driveway | scene | S15 |

### Props / evidence

| subject_id | Type | Shots |
|---|---|---|
| prop/scholarship-letter-100k | prop | S5, S10, S14 |
| prop/bentley-keys-docs | prop | S13 |
| prop/studio-share-papers | prop | S13, S16 |
| prop/wineglass-white-knuckle | prop | S3 |
| prop/phone-split | prop | S12 |

---

## Generation order (recommended)

1. char/serena 三视图 → lock → expressions + costume  
2. char/james, char/amy, char/kate 三视图  
3. scenes (villa first — most shots)  
4. props / evidence close-ups  
5. consistency_check across char sheets before 04

## Output expectation (when unblocked)

Per subject folder under `03-assets/<subject_id>/v1/`: `prompt.md`, `params.json`, `refs/`, `output.*`, `meta.md`.  
This root `v1/` holds the pack brief until ComfyUI returns images.
