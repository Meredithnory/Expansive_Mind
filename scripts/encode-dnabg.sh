#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/media/dnabg-4k.mov"
mp4="$root/public/dnabg.mp4"
webm="$root/public/dnabg.webm"
poster="$root/public/dnabg-poster.jpg"

if [[ ! -f "$src" ]]; then
  echo "missing 4K master: $src" >&2
  exit 1
fi

ffmpeg -y -hide_banner -i "$src" -an \
  -vf "scale=2560:1440:flags=lanczos" \
  -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.2 \
  -crf 30 -preset medium -movflags +faststart \
  "$mp4"

ffmpeg -y -hide_banner -i "$src" -an \
  -vf "scale=2560:1440:flags=lanczos" \
  -c:v libvpx-vp9 -pix_fmt yuv420p \
  -b:v 2M -minrate 500k -maxrate 2.5M -bufsize 4M \
  -deadline good -cpu-used 3 -row-mt 1 \
  "$webm"

ffmpeg -y -hide_banner -ss 2 -i "$src" -an \
  -vf "scale=2560:1440:flags=lanczos" -frames:v 1 -q:v 4 \
  "$poster"

exec node "$root/scripts/check-dnabg-hd.mjs"
