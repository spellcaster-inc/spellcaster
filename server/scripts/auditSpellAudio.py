#!/usr/bin/env python3
"""Read-only catalog audio audit. Requires Python 3 and ffmpeg on PATH."""

import concurrent.futures
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "client/public"


def inspect(entry):
    path = PUBLIC / entry["audioUrl"].lstrip("/")
    if not path.is_file():
        return [f'{entry["audioUrl"]}: missing file']
    result = subprocess.run(
        ["ffmpeg", "-v", "info", "-nostdin", "-nostats", "-xerror", "-i", str(path),
         "-af", "silencedetect=noise=-55dB:d=0.08", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    if result.returncode:
        return [f'{entry["audioUrl"]}: decode failed\n{result.stderr}']
    duration_match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", result.stderr)
    if duration_match is None:
        return [f'{entry["audioUrl"]}: cannot determine duration']
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
                issues.append(f'{entry["audioUrl"]}: {length:.3f}s {label} silence')
            start = None
    if start is not None and duration - start > 0.75:
        issues.append(f'{entry["audioUrl"]}: long silence through end of file')
    return issues


def main():
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required; this audit never generates or modifies audio.")
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
        for result in executor.map(inspect, entries):
            issues.extend(result)
    print(f"Audited {len(entries)} catalog clips: " + (f"{len(issues)} issue(s)." if issues else "PASS."))
    for issue in issues:
        print(issue)
    return bool(issues)


if __name__ == "__main__":
    sys.exit(main())
