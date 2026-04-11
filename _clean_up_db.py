#!/usr/bin/env python3
"""
Notion workspace cleanup (standalone; not tied to SecundusDermis).

Goals:
  • Move regular pages into ONE target database (flat: no page nested under another page).
  • List databases and flag which are already at workspace vs nested (API cannot move DBs).

Requires: Python 3.9+ (stdlib only).

Environment:
  NOTION_TOKEN                 — integration secret (required)
  NOTION_TARGET_DATABASE_ID    — UUID of the database that will hold all moved pages (required
                                 unless --create-target-db or --under-page is used)

Usage examples:
  export NOTION_TOKEN="secret_..."
  export NOTION_TARGET_DATABASE_ID="xxxxxxxx..."
  python _clean_up_db.py --dry-run
  python _clean_up_db.py

  python _clean_up_db.py --create-target-db --dry-run   # create DB at workspace (public bots)
  python _clean_up_db.py --under-page <page_uuid> --create-target-db --dry-run

  # Flatten: pull every page that sits under another page into the target DB (deepest first),
  # re-scanning after each batch so nothing stays nested. Optional workspace pages too.
  python _clean_up_db.py --flatten --passes 8

  # Move every row from one data source into another database (by database id):
  python _clean_up_db.py --migrate-from-data-source 1d288677-... \\
      --migrate-into-database e40d51ab-... --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

NOTION_VERSION = "2025-09-03"
BASE = "https://api.notion.com"


def nid(raw: str) -> str:
    return raw.replace("-", "").lower() if raw else ""


def notion_request(
    method: str,
    path: str,
    token: str,
    body: Optional[dict] = None,
    *,
    retries: int = 4,
) -> Any:
    url = BASE + path
    data = None if body is None else json.dumps(body).encode("utf-8")
    delay = 1.0
    last_err: Optional[Exception] = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Notion-Version", NOTION_VERSION)
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else {}
        except urllib.error.HTTPError as e:
            payload = e.read().decode("utf-8", errors="replace")
            last_err = RuntimeError(f"HTTP {e.code} {path}: {payload}")
            if e.code == 429 and attempt < retries:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise last_err from e
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            raise
    raise last_err  # pragma: no cover


def search_all(token: str) -> List[dict]:
    out: List[dict] = []
    cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        data = notion_request("POST", "/v1/search", token, body)
        out.extend(data.get("results") or [])
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return out


def get_primary_data_source_id(token: str, database_id: str) -> str:
    db = notion_request("GET", f"/v1/databases/{database_id}", token)
    sources = db.get("data_sources") or []
    if not sources:
        raise RuntimeError(
            "Database has no data_sources; use a full-page database shared with the integration."
        )
    ds = sources[0].get("id")
    if not ds:
        raise RuntimeError("Could not read data source id from database response.")
    return ds


def resolve_data_source_id(token: str, database_or_data_source_id: str) -> str:
    """
    If the id is a database, return its first data_source id; if GET database 404s,
    treat the id as a data_source id (verify with GET data_sources).
    """
    raw = database_or_data_source_id.strip()
    db_err: Optional[Exception] = None
    try:
        db = notion_request("GET", f"/v1/databases/{raw}", token)
        sources = db.get("data_sources") or []
        if sources and sources[0].get("id"):
            return sources[0]["id"]
        raise RuntimeError("Database has no data_sources in response")
    except RuntimeError as e:
        db_err = e
        if "404" not in str(e):
            raise
    try:
        notion_request("GET", f"/v1/data_sources/{raw}", token)
        return raw
    except RuntimeError as e:
        raise RuntimeError(
            f"Id is not an accessible database or data_source. "
            f"Database error: {db_err!s}. Data source error: {e!s}"
        ) from e


def query_all_pages_in_data_source(token: str, data_source_id: str) -> List[dict]:
    """Paginate POST /v1/data_sources/{id}/query; return only object==page."""
    out: List[dict] = []
    cursor: Optional[str] = None
    while True:
        body: Dict[str, Any] = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        data = notion_request(
            "POST", f"/v1/data_sources/{data_source_id}/query", token, body
        )
        for item in data.get("results") or []:
            if item.get("object") == "page":
                out.append(item)
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return out


def migrate_data_source_to_database(
    token: str,
    source_database_or_ds_id: str,
    target_database_id: str,
    *,
    dry_run: bool,
) -> int:
    source_ds = resolve_data_source_id(token, source_database_or_ds_id)
    target_ds = get_primary_data_source_id(token, target_database_id)
    if nid(source_ds) == nid(target_ds):
        print("Source and target resolve to the same data source; nothing to do.")
        return 0
    print(f"Source data_source_id: {source_ds}")
    print(f"Target data_source_id: {target_ds}")
    print("Querying source…")
    pages = query_all_pages_in_data_source(token, source_ds)
    print(f"Found {len(pages)} page(s) in source.")
    for pg in pages:
        title = page_title_plain(pg)
        print(f"  {title!r}  id={pg.get('id')}")
    if dry_run:
        print("\n[dry-run] No moves performed.")
        return 0
    ok = 0
    for pg in pages:
        pid = pg.get("id")
        title = page_title_plain(pg)
        try:
            move_page_to_data_source(token, pid, target_ds)
            print(f"Moved: {title!r} ({pid})")
            ok += 1
            time.sleep(0.35)
        except Exception as e:
            print(f"FAILED {title!r} ({pid}): {e}", file=sys.stderr)
    print(f"\nDone. Moved {ok}/{len(pages)} page(s). If any failed, schemas may be incompatible.")
    return 0 if ok == len(pages) else 1


def create_database(
    token: str,
    *,
    parent_page_id: Optional[str],
    use_workspace: bool,
    title: str,
) -> str:
    if use_workspace:
        parent = {"type": "workspace", "workspace": True}
    else:
        if not parent_page_id:
            raise ValueError("parent_page_id required when not using workspace parent")
        parent = {"type": "page_id", "page_id": parent_page_id}
    created = notion_request(
        "POST",
        "/v1/databases",
        token,
        {
            "parent": parent,
            "title": [{"type": "text", "text": {"content": title}}],
            "properties": {
                "Name": {"title": {}},
            },
        },
    )
    return created["id"]


def move_page_to_data_source(token: str, page_id: str, data_source_id: str) -> None:
    notion_request(
        "POST",
        f"/v1/pages/{page_id}/move",
        token,
        {"parent": {"type": "data_source_id", "data_source_id": data_source_id}},
    )


def page_title_plain(page: dict) -> str:
    props = page.get("properties") or {}
    for _k, pv in props.items():
        if isinstance(pv, dict) and pv.get("type") == "title":
            title = pv.get("title") or []
            parts = []
            for t in title:
                if t.get("type") == "text" and t.get("plain_text"):
                    parts.append(t["plain_text"])
            return "".join(parts).strip() or "(untitled)"
    return "(untitled)"


def parent_type(parent: dict) -> str:
    return (parent or {}).get("type") or ""


def nested_under_page_depth(page_id: str, parent_by_page: Dict[str, dict]) -> int:
    """How many consecutive page_id ancestors (this page under page under ...)."""
    depth = 0
    seen = set()
    cur = nid(page_id)
    while cur and cur not in seen:
        seen.add(cur)
        par = parent_by_page.get(cur) or {}
        if parent_type(par) != "page_id":
            break
        depth += 1
        cur = nid(par.get("page_id", ""))
    return depth


def parent_is_target(
    parent: dict, target_ds: str, target_db: str
) -> bool:
    t = parent_type(parent)
    if t == "data_source_id":
        return nid(parent.get("data_source_id", "")) == nid(target_ds)
    if t == "database_id":
        return nid(parent.get("database_id", "")) == nid(target_db)
    return False


def build_page_indexes(
    pages: List[dict],
) -> Tuple[Dict[str, dict], Dict[str, dict]]:
    parent_by_page: Dict[str, dict] = {}
    page_records: Dict[str, dict] = {}
    for pg in pages:
        pid = nid(pg["id"])
        parent_by_page[pid] = pg.get("parent") or {}
        page_records[pid] = pg
    return parent_by_page, page_records


def collect_pages_to_flatten(
    pages: List[dict],
    parent_by_page: Dict[str, dict],
    *,
    target_db_id: str,
    target_ds: str,
    skip_workspace_root: bool,
) -> List[Tuple[int, str, str]]:
    """Return (depth, raw_page_id, title) sorted deepest-first for stable flattening."""
    target_db_n = nid(target_db_id)
    to_move: List[Tuple[int, str, str]] = []
    for pg in pages:
        pid_raw = pg["id"]
        pid = nid(pid_raw)
        if pid == target_db_n:
            continue
        par = pg.get("parent") or {}
        if parent_is_target(par, target_ds, target_db_id):
            continue
        pt = parent_type(par)
        depth = nested_under_page_depth(pid_raw, parent_by_page)
        under_page = pt == "page_id"
        want_root = pt == "workspace" and not skip_workspace_root
        if under_page or want_root:
            title = page_title_plain(pg)
            to_move.append((depth, pid_raw, title))
    to_move.sort(key=lambda x: (-x[0], x[2].lower()))
    return to_move


def main() -> int:
    p = argparse.ArgumentParser(description="Notion: flatten pages into one database; report DB layout.")
    p.add_argument("--dry-run", action="store_true", help="Print actions only; no API writes except search/retrieve.")
    p.add_argument("--token", default=os.environ.get("NOTION_TOKEN"), help="Or set NOTION_TOKEN.")
    p.add_argument(
        "--target-database-id",
        default=os.environ.get("NOTION_TARGET_DATABASE_ID"),
        help="Or set NOTION_TARGET_DATABASE_ID.",
    )
    p.add_argument(
        "--create-target-db",
        action="store_true",
        help="Create a new database (Name title column) and use it as target.",
    )
    p.add_argument(
        "--under-page",
        default=None,
        metavar="PAGE_ID",
        help="With --create-target-db, parent page for the new database (internal integrations).",
    )
    p.add_argument(
        "--workspace-db",
        action="store_true",
        help="With --create-target-db, parent is workspace (often only for public integrations).",
    )
    p.add_argument(
        "--skip-workspace-root",
        action="store_true",
        help="Do not move top-level (workspace) pages; only flatten page-under-page.",
    )
    p.add_argument(
        "--flatten",
        action="store_true",
        help="Strong flatten: run multiple passes (default 10) re-searching after each batch.",
    )
    p.add_argument(
        "--passes",
        type=int,
        default=None,
        metavar="N",
        help="How many search→move rounds (default 1, or 10 with --flatten).",
    )
    p.add_argument(
        "--migrate-from-data-source",
        metavar="DS_OR_DB_ID",
        default=None,
        help="Data source id (or database id) whose pages to move.",
    )
    p.add_argument(
        "--migrate-into-database",
        metavar="DATABASE_ID",
        default=None,
        help="Target database id (first data source receives all rows).",
    )
    args = p.parse_args()
    if args.passes is not None:
        passes = max(1, args.passes)
    elif args.flatten:
        passes = 10
    else:
        passes = 1

    token = args.token
    if not token:
        print("Missing NOTION_TOKEN (or pass --token).", file=sys.stderr)
        return 1

    mf, mt = args.migrate_from_data_source, args.migrate_into_database
    if mf or mt:
        if not mf or not mt:
            print(
                "Migration requires both --migrate-from-data-source and --migrate-into-database.",
                file=sys.stderr,
            )
            return 1
        try:
            return migrate_data_source_to_database(
                token, mf, mt, dry_run=args.dry_run
            )
        except RuntimeError as e:
            print(e, file=sys.stderr)
            return 1

    target_db_id = args.target_database_id
    if args.create_target_db:
        if target_db_id:
            print("Pass only one of --target-database-id or --create-target-db.", file=sys.stderr)
            return 1
        if args.dry_run:
            print("[dry-run] Would create target database (title: Cleanup — All pages).")
        else:
            try:
                target_db_id = create_database(
                    token,
                    parent_page_id=args.under_page,
                    use_workspace=args.workspace_db and not args.under_page,
                    title="Cleanup — All pages",
                )
            except Exception as e:
                print(
                    "Creating database failed. Internal integrations often need "
                    "--under-page <PAGE_ID>. Public integrations may use --workspace-db.\n"
                    f"Error: {e}",
                    file=sys.stderr,
                )
                return 1
            print(f"Created target database id: {target_db_id}")
    if not target_db_id:
        print(
            "Set NOTION_TARGET_DATABASE_ID or use --create-target-db (see --help).",
            file=sys.stderr,
        )
        return 1

    target_ds = get_primary_data_source_id(token, target_db_id)
    print(f"Target data_source_id (for moves): {target_ds}")

    print("Searching workspace…")
    results = search_all(token)
    databases = [r for r in results if r.get("object") == "database" and not r.get("in_trash")]
    pages = [r for r in results if r.get("object") == "page" and not r.get("in_trash")]

    target_db_n = nid(target_db_id)

    print("\n=== Databases (Notion API cannot move database objects) ===")
    nested_dbs: List[Tuple[str, str]] = []
    top_dbs: List[str] = []
    for d in databases:
        did = d.get("id", "")
        par = d.get("parent") or {}
        pt = parent_type(par)
        title_bits = d.get("title") or []
        name = ""
        if title_bits and isinstance(title_bits[0], dict):
            name = (title_bits[0].get("plain_text") or "").strip()
        label = name or did
        if nid(did) == target_db_n:
            print(f"  [TARGET] {label}  id={did}  parent={pt}")
            continue
        if pt == "workspace":
            top_dbs.append(label)
            print(f"  [workspace] {label}  id={did}")
        elif pt == "page_id":
            nested_dbs.append((label, did))
            print(f"  [nested under page] {label}  id={did}")
        else:
            print(f"  [{pt}] {label}  id={did}")

    if nested_dbs:
        print(
            "\nTo put databases “on top”, open Notion and drag these to the workspace "
            "(or move via UI). The API does not support moving databases.",
        )

    parent_by_page, _page_records = build_page_indexes(pages)
    to_move = collect_pages_to_flatten(
        pages,
        parent_by_page,
        target_db_id=target_db_id,
        target_ds=target_ds,
        skip_workspace_root=args.skip_workspace_root,
    )

    print(f"\n=== Pages to move into target database (pass 1 plan): {len(to_move)} ===")
    for depth, pid, title in to_move:
        print(f"  depth={depth}  {title!r}  id={pid}")
    if passes > 1 and not args.dry_run:
        print(f"\n(Multi-pass mode: up to {passes} search→move rounds until nothing left under a page.)")

    if args.dry_run:
        print("\n[dry-run] No moves performed.")
        return 0

    total_moved = 0
    for pnum in range(1, passes + 1):
        results = search_all(token)
        pages = [r for r in results if r.get("object") == "page" and not r.get("in_trash")]
        parent_by_page, _ = build_page_indexes(pages)
        batch = collect_pages_to_flatten(
            pages,
            parent_by_page,
            target_db_id=target_db_id,
            target_ds=target_ds,
            skip_workspace_root=args.skip_workspace_root,
        )
        if not batch:
            print(f"\nPass {pnum}: nothing left to flatten.")
            break
        print(f"\n--- Pass {pnum}/{passes}: moving {len(batch)} page(s) ---")
        for depth, pid, title in batch:
            try:
                move_page_to_data_source(token, pid, target_ds)
                print(f"Moved: {title!r} ({pid})")
                total_moved += 1
                time.sleep(0.35)
            except Exception as e:
                print(f"FAILED {title!r} ({pid}): {e}", file=sys.stderr)

    print(f"\nDone. Moved {total_moved} page(s) total. Re-run with --dry-run to verify; refresh Notion.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
