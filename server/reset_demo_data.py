"""
Reset the demo database to a clean state: the seeded sample records, the mock LRMS
master, the 3 demo users, and a fresh audit hash chain. All uploads and edits are removed.

    cd server
    python reset_demo_data.py          (asks for confirmation)
    python reset_demo_data.py --yes

Safe to run while uvicorn is running; refresh the browser afterwards.
Uploaded scan files on disk are left alone.
"""
import sqlite3, sys
from pathlib import Path

DB = Path(__file__).parent / "bhoolekha.db"
if "--yes" not in sys.argv:
    if input(f"This deletes ALL records, uploads and audit entries in {DB.name}. Type RESET to continue: ").strip() != "RESET":
        sys.exit("Cancelled.")

con = sqlite3.connect(DB, timeout=15)
con.execute("PRAGMA foreign_keys=OFF")
tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
for t in tables:
    con.execute(f'DROP TABLE IF EXISTS "{t}"')
con.commit()
con.execute("VACUUM")
con.close()
print(f"Dropped {len(tables)} tables.")

sys.path.insert(0, str(Path(__file__).parent))
from db_service import init_db
init_db()

from database import SessionLocal
from models import ParcelRecord
from audit_chain import verify_chain
db = SessionLocal()
print(f"Done: {db.query(ParcelRecord).count()} sample records, audit chain {verify_chain(db)}")
db.close()
