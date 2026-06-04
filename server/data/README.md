# Server-side data (pipeline & demos)

| Path | Role |
|------|------|
| `hmda_2025_sample_60000.csv` | Raw HMDA sample for training, `process_hmda_mlar.py`, and scenario config export |
| `user_upload_pack/` | Persona transaction CSVs + `user_profiles_seed.csv` (register in app, then upload matching CSV) |

**Runtime JSON** (HMDA viz, model, auth fallback) lives under `client/public/data/` — see `server/paths.py`.

Scripts and the notebook should use `server/data/...`, not a repo-root `data/` folder.
