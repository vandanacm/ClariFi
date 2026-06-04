"""Canonical data paths for ClariFi (repo root = parent of server/)."""
from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SERVER_DATA = PROJECT_ROOT / "server" / "data"
PUBLIC_DATA = PROJECT_ROOT / "client" / "public" / "data"
MODEL_OUTPUTS = PUBLIC_DATA / "model_outputs"

LOCAL_STORE_PATH = PUBLIC_DATA / "local_store.json"
LOCAL_STORE_SEED_PATH = PUBLIC_DATA / "local_store.seed.json"
HMDA_SAMPLE_CSV = SERVER_DATA / "hmda_2025_sample_60000.csv"
HMDA_PROCESSED_JSON = PUBLIC_DATA / "hmda_processed.json"
MODEL_REPORT_JSON = PUBLIC_DATA / "model_report.json"
USER_UPLOAD_PACK = SERVER_DATA / "user_upload_pack"
