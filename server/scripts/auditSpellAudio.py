#!/usr/bin/env python3
"""Read-only catalog audio audit. Requires Python 3 and ffmpeg on PATH."""

import argparse
import concurrent.futures
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "client/public"


def inspect_clip(path):
    if not path.is_file():
        return ["missing file"]
    result = subprocess.run(
        ["ffmpeg", "-v", "info", "-nostdin", "-nostats", "-xerror", "-i", str(path),
         "-af", "silencedetect=noise=-55dB:d=0.08", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    if result.returncode:
        return ["FFmpeg could not decode the clip"]
    duration_match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", result.stderr)
    if duration_match is None:
        return ["cannot determine duration"]
    duration = sum(float(v) * scale for v, scale in zip(duration_match.groups(), (3600, 60, 1)))
    issues = []
    start = None
    for kind, value in re.findall(r"silence_(start|end): ([\d.]+)", result.stderr):
        if kind == "start":
            start = float(value)
        elif start is not None:
            end = float(value)
            length = end - start
            leading = start < 0.01
            # FFmpeg's decoded timeline excludes some MP3 container padding.
            trailing = end >= duration - 0.15
            limit = 0.5 if leading else 0.75
            if length > limit:
                label = "leading" if leading else "trailing" if trailing else "internal"
                issues.append(f"{length:.3f}s {label} silence")
            start = None
    if start is not None and duration - start > 0.75:
        issues.append("long silence through end of file")
    return issues


def inspect_entry(entry):
    audio_url = entry["audioUrl"]
    path = PUBLIC / audio_url.lstrip("/")
    return [f"{audio_url}: {issue}" for issue in inspect_clip(path)]


def audit_catalog():
    manifest = json.loads((ROOT / "server/data/spellAudioManifest.json").read_text())
    catalog = json.loads((ROOT / "server/src/game/spellCatalog.json").read_text())
    issues = []
    for tier, entries in manifest.items():
        if [entry["spell"] for entry in entries] != catalog[tier]:
            issues.append(f"{tier}: manifest spell order differs from catalog")
    entries = [entry for tier in manifest.values() for entry in tier]
    expected = {str(PUBLIC / entry["audioUrl"].lstrip("/")) for entry in entries}
    actual = {str(path) for path in (PUBLIC / "audio/spells").rglob("*.mp3")}
    for extra in sorted(actual - expected):
        issues.append(f"Unmapped MP3: {extra}")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for result in executor.map(inspect_entry, entries):
            issues.extend(result)
    print(f"Audited {len(entries)} catalog clips: " + (f"{len(issues)} issue(s)." if issues else "PASS."))
    for issue in issues:
        print(issue)
    return bool(issues)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--clip", type=pathlib.Path, help="check one MP3 file")
    mode.add_argument("--check-tools", action="store_true", help="check that FFmpeg is available")
    args = parser.parse_args()
    if not shutil.which("ffmpeg"):
        parser.exit(2, "FFmpeg is required for the spell audio audit. Install it and add it to PATH.\n")
    if args.check_tools:
        return 0
    if args.clip is not None:
        issues = inspect_clip(args.clip)
        for issue in issues:
            print(issue)
        return bool(issues)
    return audit_catalog()


if __name__ == "__main__":
    sys.exit(main())
