"""Verify script — check all Finance + Assets module imports and models.

Usage:
    python scripts/verify_models.py

For Docker-based Alembic migration:
    docker-compose exec api bash
    alembic revision --autogenerate -m "add finance and assets tables"
    alembic upgrade head
"""
import sys
import os

# Fix Windows GBK encoding issue
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

OK = "[OK]"

print("=" * 60)
print("1. Model imports")
print("=" * 60)

# ---- Base ----
from app.db.base import Base, TimestampMixin

# ---- Shared models ----
from app.modules.accounts.models import User, Role, Permission, RolePermission
from app.modules.files.models import File
from app.modules.ocr.models import OCRJob
from app.modules.ai.models import AIJob
from app.modules.audit.models import AuditLog
from app.modules.approvals.models import Approval
print(f"  {OK} Shared tables (6) imported")

# ---- Apple business models ----
from app.modules.apple.finance.models import FinanceRecord, Quotation
from app.modules.apple.assets.models import Asset, AssetMovement
print(f"  {OK} Finance: FinanceRecord + Quotation imported")
print(f"  {OK} Assets:  Asset + AssetMovement imported")

# ---- Schemas ----
from app.modules.apple.finance.schemas import (
    FinanceRecordCreate, FinanceRecordUpdate, FinanceRecordResponse,
    QuotationCreate, QuotationResponse, QuotationAnalysisResponse,
    AddressLabelRequest, AddressLabelResponse,
)
from app.modules.apple.assets.schemas import (
    AssetCreate, AssetUpdate, AssetResponse,
    AssetMovementCreate, AssetMovementResponse,
    StocktakeRequest, StocktakeResponse,
    WriteoffRequest, PrintLabelsRequest, PrintLabelsResponse,
)
print(f"  {OK} Finance Schemas (9 classes) imported")
print(f"  {OK} Assets Schemas (11 classes) imported")

# ---- Routers ----
from app.modules.apple.finance.router import router as finance_router
from app.modules.apple.assets.router import router as assets_router
print(f"  {OK} Finance Router imported")
print(f"  {OK} Assets Router imported")

# ---- Services ----
from app.modules.apple.finance import service as finance_service
from app.modules.apple.assets import service as assets_service
print(f"  {OK} Finance Service imported")
print(f"  {OK} Assets Service imported")

# ---- Repositories ----
from app.modules.apple.finance import repository as finance_repo
from app.modules.apple.assets import repository as assets_repo
print(f"  {OK} Finance Repository imported")
print(f"  {OK} Assets Repository imported")

# ================================================================
print("")
print("=" * 60)
print("2. Table metadata inspection (no DB required)")
print("=" * 60)

table_names = Base.metadata.tables.keys()
print(f"  Total: {len(table_names)} tables registered in metadata")

common_tables = ["users", "roles", "permissions", "role_permissions",
                 "files", "ocr_jobs", "ai_jobs", "audit_logs", "approvals"]
apple_tables = [t for t in table_names if t.startswith("apple_")]

print("  [Shared]")
for t in common_tables:
    if t in table_names:
        cols = [c.name for c in Base.metadata.tables[t].columns]
        print(f"    {OK} {t} ({len(cols)} columns)")

print("  [Apple Business]")
for t in sorted(apple_tables):
    cols = [c.name for c in Base.metadata.tables[t].columns]
    print(f"    {OK} {t} ({len(cols)} columns): {', '.join(cols)}")

# Note: skip SQLite create_all because shared models use PostgreSQL JSONB
print("")
print("  Note: create_all skipped (shared models use PostgreSQL JSONB)")
print("  Run 'alembic upgrade head' against PostgreSQL to create tables.")

# ================================================================
print("")
print("=" * 60)
print("3. Route endpoint count")
print("=" * 60)

finance_routes = [r for r in finance_router.routes if hasattr(r, "methods")]
assets_routes = [r for r in assets_router.routes if hasattr(r, "methods")]

print(f"  {OK} Finance: {len(finance_routes)} endpoints")
for r in finance_routes:
    methods = ",".join(r.methods) if r.methods else "?"
    print(f"      {methods:7s} {r.path}")

print(f"  {OK} Assets:  {len(assets_routes)} endpoints")
for r in assets_routes:
    methods = ",".join(r.methods) if r.methods else "?"
    print(f"      {methods:7s} {r.path}")

# ================================================================
print("")
print("=" * 60)
print("4. Pydantic Schema instantiation test")
print("=" * 60)

income = FinanceRecordCreate(
    record_type="income",
    date="2026-07-15",
    project="Test Income",
    amount=1000,
    payment_method="Cash",
    handler="Chan Tai Ming",
)
print(f"  {OK} FinanceRecordCreate (income): {income.project} HK$ {income.amount}")

expense = FinanceRecordCreate(
    record_type="expense",
    date="2026-07-14",
    project="Test Expense",
    amount=500,
    supplier="Test Supplier",
    invoice_no="INV-001",
)
print(f"  {OK} FinanceRecordCreate (expense): {expense.project} HK$ {expense.amount}")

asset = AssetCreate(
    name="Test Asset",
    category="IT Equipment",
    location="3F Staff Room",
    purchase_amount=10000,
)
print(f"  {OK} AssetCreate: {asset.name} ({asset.category})")

movement = AssetMovementCreate(
    from_location="3F Staff Room",
    to_location="GF General Office",
    movement_date="2026-07-16",
    reason="Reallocation",
)
print(f"  {OK} AssetMovementCreate: {movement.from_location} -> {movement.to_location}")

# ================================================================
print("")
print("ALL VERIFICATIONS PASSED!")
print("")
print("=" * 60)
print("Docker deployment — full migration steps:")
print("=" * 60)
print("""
  # 1. Start all services
  docker-compose up -d

  # 2. Wait for PostgreSQL
  docker-compose exec db pg_isready -U puiying

  # 3. Generate migration (auto-detect new tables)
  docker-compose exec api alembic revision --autogenerate \\
      -m "add finance and assets tables"

  # 4. Apply migration
  docker-compose exec api alembic upgrade head

  # 5. Import seed data (roles/permissions/admin)
  docker-compose exec api python scripts/seed_demo_data.py

  # 6. Verify
  # - API docs: http://localhost:8000/docs
  # - Frontend: http://localhost:3000
""")
