"""Pytest uses local JSON storage; do not require live MongoDB Atlas."""
from __future__ import annotations

import os

os.environ["MONGODB_URI"] = ""
os.environ["MONGODB_FALLBACK_LOCAL"] = "true"
