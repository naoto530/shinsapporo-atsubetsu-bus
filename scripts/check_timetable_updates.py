#!/usr/bin/env python3
"""Check official timetable sources and update safe GTFS-backed routes.

This script is designed for GitHub Actions. It downloads known official/public
sources, compares their fingerprints, and updates only routes that can be
reliably derived from GTFS stop times.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path


DAY_TYPES = ("weekday", "saturday", "holiday")

SOURCES = {
    "chuo_gtfs": {
        "label": "北海道中央バス GTFS",
        "url": "https://ckan.hoda.jp/dataset/24d1dd70-5395-4d6b-b41f-0d83e8eabdb9/resource/dbadfccc-670e-49b9-be77-c3f346ee3160/download/hokkaido_chuo.zip",
        "kind": "gtfs",
    },
    "yutetsu_gtfs": {
        "label": "夕鉄バス GTFS",
        "url": "https://ckan.hoda.jp/dataset/24d1dd70-5395-4d6b-b41f-0d83e8eabdb9/resource/594c9dd3-d356-4445-98e2-c480d49c9d65/download/yutetsu_bus.zip",
        "kind": "gtfs",
    },
    "jhb_no10_pdf": {
        "label": "JR北海道バス No.10 PDF",
        "url": "https://www.jrhokkaidobus.com/pdf/timetable/2026_04/10.pdf",
        "kind": "pdf",
    },
}

ROUTE_RULES = [
    {
        "id": "chuo-shiro38-n13",
        "source": "chuo_gtfs",
        "route_ids": ["R010200233"],
        "origin_stop_ids": ["S010200097300400"],
        "target_stop_ids": ["S010200238900100"],
        "auto_apply": True,
    },
    {
        "id": "chuo-shiro35-n13",
        "source": "chuo_gtfs",
        "route_ids": ["R010200232"],
        "origin_stop_ids": ["S010200097300400"],
        "target_stop_ids": ["S010200238900100"],
        "auto_apply": True,
    },
    {
        "id": "yutetsu-ebetsu-n12",
        "source": "yutetsu_gtfs",
        "route_ids": ["R018100002", "R018100006"],
        "origin_stop_ids": ["S018100004200100"],
        "target_stop_ids": ["S018100007800200"],
        "auto_apply": False,
        "note": "夕鉄GTFSは現在のPDF時刻表と便数が一致しないため、検知・確認用に限定。",
    },
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timetable", default="data/timetable.json")
    parser.add_argument("--fingerprints", default="data/source-fingerprints.json")
    parser.add_argument("--report", default="reports/timetable-check.md")
    parser.add_argument("--write", action="store_true", help="write updates to timetable/fingerprint files")
    parser.add_argument("--no-report", action="store_true", help="do not write a markdown report")
    args = parser.parse_args()

    timetable_path = Path(args.timetable)
    fingerprint_path = Path(args.fingerprints)
    report_path = Path(args.report)

    timetable = read_json(timetable_path)
    previous_fingerprints = read_json(fingerprint_path, default={"sources": {}})

    downloads = {key: download_source(key, source) for key, source in SOURCES.items()}
    current_fingerprints = build_fingerprints(downloads)
    source_changes = diff_fingerprints(previous_fingerprints, current_fingerprints)

    extracted = {}
    extraction_notes = []
    for rule in ROUTE_RULES:
        try:
            extracted[rule["id"]] = extract_gtfs_route(downloads[rule["source"]]["bytes"], rule)
        except Exception as error:  # noqa: BLE001 - report and continue in CI.
            extraction_notes.append(f"- {rule['id']}: 抽出失敗: {error}")

    route_changes = apply_safe_updates(timetable, extracted)
    if route_changes:
        today = dt.date.today().isoformat()
        timetable.setdefault("metadata", {})["updatedAt"] = today
        timetable["metadata"]["version"] = f"auto-check-{today}"

    should_write_report = bool(source_changes or route_changes or extraction_notes)
    if args.write:
        if route_changes:
            write_json(timetable_path, timetable)
        if source_changes or not fingerprint_path.exists():
            write_json(fingerprint_path, current_fingerprints)
        if should_write_report and not args.no_report:
            write_report(report_path, source_changes, route_changes, extracted, extraction_notes)

    print_summary(source_changes, route_changes, extracted, extraction_notes)
    return 0


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def download_source(key: str, source: dict) -> dict:
    request = urllib.request.Request(source["url"], headers={"User-Agent": "atsubetsu-bus-timetable-checker/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
        headers = dict(response.headers.items())
    return {
        "key": key,
        "source": source,
        "bytes": body,
        "sha256": hashlib.sha256(body).hexdigest(),
        "size": len(body),
        "headers": headers,
    }


def build_fingerprints(downloads: dict) -> dict:
    sources = {}
    for key, item in downloads.items():
        feed_info = {}
        if item["source"]["kind"] == "gtfs":
            feed_info = read_feed_info(item["bytes"])
        sources[key] = {
            "label": item["source"]["label"],
            "url": item["source"]["url"],
            "sha256": item["sha256"],
            "size": item["size"],
            "lastModified": item["headers"].get("Last-Modified", ""),
            "etag": item["headers"].get("ETag", ""),
            "feedInfo": feed_info,
        }
    return {
        "checkedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "sources": sources,
    }


def read_feed_info(zip_bytes: bytes) -> dict:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        if "feed_info.txt" not in archive.namelist():
            return {}
        rows = read_csv_from_zip(archive, "feed_info.txt")
    return rows[0] if rows else {}


def diff_fingerprints(previous: dict, current: dict) -> list[dict]:
    changes = []
    previous_sources = previous.get("sources", {}) if previous else {}
    for key, source in current["sources"].items():
        before = previous_sources.get(key, {})
        if before.get("sha256") != source.get("sha256"):
            changes.append({
                "key": key,
                "label": source["label"],
                "old": before.get("sha256", "(none)"),
                "new": source["sha256"],
            })
    return changes


def extract_gtfs_route(zip_bytes: bytes, rule: dict) -> dict:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        stops = {row["stop_id"]: row for row in read_csv_from_zip(archive, "stops.txt")}
        trips = read_csv_from_zip(archive, "trips.txt")
        stop_times = read_csv_from_zip(archive, "stop_times.txt")
        calendar = read_csv_from_zip(archive, "calendar.txt")
        calendar_dates = read_csv_from_zip(archive, "calendar_dates.txt")

    stop_times_by_trip = defaultdict(list)
    for row in stop_times:
        stop_times_by_trip[row["trip_id"]].append(row)

    trips_by_route = [
        trip for trip in trips
        if trip["route_id"] in set(rule["route_ids"])
    ]

    result = {"timetables": {}, "travelTimeMinutes": None, "representativeDates": {}}
    travel_minutes = []
    for day_type in DAY_TYPES:
        date = find_representative_date(day_type, calendar, calendar_dates, trips_by_route, stop_times_by_trip, rule)
        result["representativeDates"][day_type] = date.isoformat() if date else ""
        rows = collect_departures_for_date(date, calendar, calendar_dates, trips_by_route, stop_times_by_trip, rule)
        result["timetables"][day_type] = sorted({row["time"] for row in rows})
        travel_minutes.extend(row["travel"] for row in rows if row["travel"] is not None)

    if travel_minutes:
        result["travelTimeMinutes"] = Counter(travel_minutes).most_common(1)[0][0]
    result["autoApply"] = bool(rule.get("auto_apply"))
    result["note"] = rule.get("note", "")
    return result


def read_csv_from_zip(archive: zipfile.ZipFile, name: str) -> list[dict]:
    with archive.open(name) as file:
        text = io.TextIOWrapper(file, encoding="utf-8-sig", newline="")
        return list(csv.DictReader(text))


def find_representative_date(day_type, calendar, calendar_dates, trips, stop_times_by_trip, rule) -> dt.date | None:
    today = dt.date.today()
    start = min([parse_date(row["start_date"]) for row in calendar] + [today])
    search_start = max(today, start)
    for base in (search_start, start):
        for offset in range(0, 500):
            date = base + dt.timedelta(days=offset)
            if not matches_day_type(date, day_type):
                continue
            rows = collect_departures_for_date(date, calendar, calendar_dates, trips, stop_times_by_trip, rule)
            if rows:
                return date
    return None


def collect_departures_for_date(date, calendar, calendar_dates, trips, stop_times_by_trip, rule) -> list[dict]:
    if not date:
        return []
    active = active_services(calendar, calendar_dates, date)
    rows = []
    for trip in trips:
        if trip["service_id"] not in active:
            continue
        origin, target = find_origin_and_target(stop_times_by_trip[trip["trip_id"]], rule)
        if not origin or not target:
            continue
        origin_minutes = parse_gtfs_time(origin["departure_time"])
        target_minutes = parse_gtfs_time(target["arrival_time"] or target["departure_time"])
        rows.append({
            "time": format_minutes(origin_minutes),
            "travel": target_minutes - origin_minutes if target_minutes >= origin_minutes else None,
        })
    return rows


def find_origin_and_target(stop_times: list[dict], rule: dict):
    ordered = sorted(stop_times, key=lambda row: int(row["stop_sequence"]))
    origin = None
    for row in ordered:
        if origin is None and row["stop_id"] in rule["origin_stop_ids"]:
            origin = row
            continue
        if origin is not None and row["stop_id"] in rule["target_stop_ids"]:
            return origin, row
    return None, None


def active_services(calendar, calendar_dates, date: dt.date) -> set[str]:
    ymd = date.strftime("%Y%m%d")
    weekday = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")[date.weekday()]
    active = set()
    for row in calendar:
        if row["start_date"] <= ymd <= row["end_date"] and row.get(weekday) == "1":
            active.add(row["service_id"])
    for row in calendar_dates:
        if row["date"] != ymd:
            continue
        if row["exception_type"] == "1":
            active.add(row["service_id"])
        elif row["exception_type"] == "2":
            active.discard(row["service_id"])
    return active


def matches_day_type(date: dt.date, day_type: str) -> bool:
    if day_type == "weekday":
        return date.weekday() < 5
    if day_type == "saturday":
        return date.weekday() == 5
    if day_type == "holiday":
        return date.weekday() == 6
    raise ValueError(f"unknown day type: {day_type}")


def parse_date(value: str) -> dt.date:
    return dt.date(int(value[:4]), int(value[4:6]), int(value[6:8]))


def parse_gtfs_time(value: str) -> int:
    hours, minutes, _seconds = (int(part) for part in value.split(":"))
    return hours * 60 + minutes


def format_minutes(minutes: int) -> str:
    return f"{(minutes // 60) % 24:02d}:{minutes % 60:02d}"


def apply_safe_updates(timetable: dict, extracted: dict) -> list[dict]:
    changes = []
    routes_by_id = {route["id"]: route for route in timetable.get("routes", [])}
    for route_id, generated in extracted.items():
        if not generated.get("autoApply"):
            continue
        route = routes_by_id.get(route_id)
        if not route:
            continue
        before = {
            "timetables": route.get("timetables", {}),
            "travelTimeMinutes": route.get("travelTimeMinutes"),
        }
        next_travel_time = route.get("travelTimeMinutes")
        if generated.get("autoApplyTravelTime"):
            next_travel_time = generated["travelTimeMinutes"] or route.get("travelTimeMinutes")
        after = {
            "timetables": generated["timetables"],
            "travelTimeMinutes": next_travel_time,
        }
        if before != after:
            route["timetables"] = after["timetables"]
            route["travelTimeMinutes"] = after["travelTimeMinutes"]
            changes.append({
                "routeId": route_id,
                "beforeCounts": count_timetables(before["timetables"]),
                "afterCounts": count_timetables(after["timetables"]),
            })
    return changes


def count_timetables(timetables: dict) -> dict:
    return {day_type: len(timetables.get(day_type, [])) for day_type in DAY_TYPES}


def write_report(path: Path, source_changes, route_changes, extracted, extraction_notes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 時刻表自動チェック結果",
        "",
        f"- 実行日時: {dt.datetime.now().replace(microsecond=0).isoformat()}",
        "",
        "## 公式データの変更",
    ]
    if source_changes:
        for change in source_changes:
            lines.append(f"- {change['label']}: SHA256 changed `{change['old'][:12]}` -> `{change['new'][:12]}`")
    else:
        lines.append("- 変更なし")

    lines += ["", "## 自動反映した路線"]
    if route_changes:
        for change in route_changes:
            lines.append(f"- {change['routeId']}: {change['beforeCounts']} -> {change['afterCounts']}")
    else:
        lines.append("- なし")

    lines += ["", "## 抽出結果メモ"]
    for route_id, generated in extracted.items():
        counts = count_timetables(generated.get("timetables", {}))
        marker = "自動反映対象" if generated.get("autoApply") else "確認のみ"
        lines.append(f"- {route_id} ({marker}): {counts}, 所要 {generated.get('travelTimeMinutes')}分")
        if generated.get("note"):
            lines.append(f"  - {generated['note']}")
    if extraction_notes:
        lines += ["", "## 抽出エラー"]
        lines.extend(extraction_notes)

    lines += [
        "",
        "## 手動確認が必要なもの",
        "- JR北海道バス No.10 PDF が変更された場合は、PDFの表を確認して `data/timetable.json` のJR路線を更新してください。",
        "- 夕鉄バスはGTFSとPDFの便数差があるため、現時点では自動反映せず確認のみです。",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def print_summary(source_changes, route_changes, extracted, extraction_notes) -> None:
    print(f"source changes: {len(source_changes)}")
    print(f"route changes: {len(route_changes)}")
    for route_id, generated in extracted.items():
        print(route_id, count_timetables(generated.get("timetables", {})), "autoApply=", generated.get("autoApply"))
    for note in extraction_notes:
        print(note, file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
