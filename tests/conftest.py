"""Pytest uses local JSON storage; do not require live MongoDB Atlas."""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ["MONGODB_URI"] = ""
os.environ["MONGODB_FALLBACK_LOCAL"] = "true"

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "server"))
