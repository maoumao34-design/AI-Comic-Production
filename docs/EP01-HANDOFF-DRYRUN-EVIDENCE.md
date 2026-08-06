# EP01 MAO-42 dry-run evidence (non-GPU)

Date: 2026-08-06  
Host: Iris Xe runtime (no NVIDIA) — intentionally no real Comfy generate.

## Commands (exit 0)

```text
node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --version v1 --dry-run
```

## Results

- handoff-check: planned=20 step03 subjects; present=0 (await GPU handoff); ready_for_human_checkpoint_03=false
- 04 dry-run: 16 keyframe subjects (S1–S16) planned dest under `assets/EP-01/04-keyframes/v1/outputs/S##/`
- 05–07 dry-run: status `dry_run_scaffold` under `assets/EP-01/{05-clips,06-voice-sub,07-final}/v1/` (not real generation)

Full JSON captures (optional local): `logs/ep01-handoff-check.log`, `logs/ep01-04-07-dry-run.log`
