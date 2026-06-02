#!/usr/bin/env python3
"""Verify MongoDB Atlas connectivity for ClariFi (run from repo root)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")

uri = (os.getenv("MONGODB_URI") or "").strip()
if not uri:
    print("MONGODB_URI is not set in .env")
    sys.exit(1)

db_name = os.getenv("MONGODB_DB", "clarifi")
collection_name = os.getenv("MONGODB_COLLECTION", "app_store")

try:
    import certifi
    from pymongo import MongoClient
except ImportError as exc:
    print("Install dependencies: pip install pymongo certifi python-dotenv")
    raise SystemExit(1) from exc

print("Connecting to Atlas…")
try:
    client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=15000)
    client.admin.command("ping")
    doc = client[db_name][collection_name].find_one({"_id": "clarifi_store"})
    users = list((doc or {}).get("users", {}).keys())
    print("OK — ping succeeded")
    print(f"  database: {db_name}")
    print(f"  collection: {collection_name}")
    print(f"  clarifi_store users: {len(users)}")
    if users:
        print(f"  sample emails: {', '.join(users[:5])}")
    client.close()
except Exception as exc:
    print("FAILED:", exc)
    print()
    print("Atlas checklist:")
    print("  1. Network Access → Add IP Address (your IP or 0.0.0.0/0 for dev)")
    print("  2. Database Access → user has readWrite on", db_name)
    print("  3. Cluster is not paused")
    print("  4. Disable VPN / try another network if TLS handshake fails")
    print("  5. Copy a fresh connection string from Atlas → Connect → Drivers")
    sys.exit(1)
