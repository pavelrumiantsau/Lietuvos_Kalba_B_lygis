#!/usr/bin/env python3
"""Packages extracted chapter content (never committed to git) into a single
content-package .zip for the user to download and load into the site locally.

Usage:
    python3 scripts/package-content.py 1 2 3
    python3 scripts/package-content.py --all   # picks up every chapter-NN folder found

Reads from content-source/chapter-NN/ (chapter-NN.json, appendix-listening-chNN.json,
images/*) and writes content-package/lkb-content-chNN-NN.zip plus a matching
manifest.json inside the zip. This script itself contains no book content — safe to
commit — but only ever operates on the gitignored content-source/ directory.
"""
import argparse
import json
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content-source"
PACKAGE_DIR = ROOT / "content-package"


def discover_all_chapters():
    nums = []
    for p in sorted(SOURCE.glob("chapter-*")):
        m = p.name.replace("chapter-", "")
        if m.isdigit():
            nums.append(int(m))
    return nums


def build_zip(chapter_nums):
    PACKAGE_DIR.mkdir(exist_ok=True)
    label = "-".join(f"{n:02d}" for n in chapter_nums) if len(chapter_nums) <= 3 else f"{chapter_nums[0]:02d}-{chapter_nums[-1]:02d}"
    zip_path = PACKAGE_DIR / f"lkb-content-ch{label}.zip"

    manifest = {"version": int(time.time()), "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"), "chapters": []}
    missing = []

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for n in chapter_nums:
            ch_dir = SOURCE / f"chapter-{n:02d}"
            ch_json = ch_dir / f"chapter-{n:02d}.json"
            if not ch_json.exists():
                missing.append(str(ch_json))
                continue
            data = json.loads(ch_json.read_text(encoding="utf-8"))
            zf.writestr(f"chapters/chapter-{n:02d}.json", json.dumps(data, ensure_ascii=False, indent=2))
            manifest["chapters"].append(n)

            appendix_json = ch_dir / f"appendix-listening-ch{n}.json"
            if appendix_json.exists():
                adata = json.loads(appendix_json.read_text(encoding="utf-8"))
                zf.writestr(f"appendix/appendix-ch{n:02d}.json", json.dumps(adata, ensure_ascii=False, indent=2))

            images_dir = ch_dir / "images"
            if images_dir.exists():
                for img in images_dir.glob("*"):
                    if img.is_file():
                        zf.writestr(f"images/chapter-{n:02d}/{img.name}", img.read_bytes())

        zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    print(f"Wrote {zip_path} with chapters {manifest['chapters']}")
    if missing:
        print("WARNING: missing chapter JSON files, skipped:", missing, file=sys.stderr)
    return zip_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("chapters", nargs="*", type=int, help="chapter numbers to package")
    parser.add_argument("--all", action="store_true", help="package every chapter-NN folder found")
    args = parser.parse_args()

    if args.all:
        nums = discover_all_chapters()
    else:
        nums = sorted(args.chapters)

    if not nums:
        print("No chapters specified and none discovered. Use --all or pass chapter numbers.", file=sys.stderr)
        sys.exit(1)

    build_zip(nums)


if __name__ == "__main__":
    main()
