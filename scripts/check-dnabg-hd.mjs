import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function probe(file) {
    const raw = execFileSync(
        "ffprobe",
        [
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height",
            "-show_entries",
            "format=size,bit_rate,duration",
            "-of",
            "json",
            file,
        ],
        { encoding: "utf8" },
    );
    return JSON.parse(raw);
}

function requireFile(rel, minHeight) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
        throw new Error(`missing ${rel}`);
    }
    const info = probe(abs);
    const stream = info.streams[0];
    const bytes = Number(info.format.size);
    if (stream.height < minHeight) {
        throw new Error(
            `${rel} is ${stream.width}x${stream.height}, expected at least ${minHeight}p`,
        );
    }
    return {
        path: rel,
        codec: stream.codec_name,
        width: stream.width,
        height: stream.height,
        bytes,
        mb: (bytes / (1024 * 1024)).toFixed(2),
        bitrateKbps: Math.round(Number(info.format.bit_rate) / 1000),
        durationSec: Number(info.format.duration).toFixed(2),
    };
}

if (existsSync(join(root, "public/dnabg.mov"))) {
    throw new Error("public/dnabg.mov is still present; browsers must not be offered the 4K QuickTime file");
}

const report = {
    mp4: requireFile("public/dnabg.mp4", 1080),
    webm: requireFile("public/dnabg.webm", 1080),
    poster: requireFile("public/dnabg-poster.jpg", 1080),
    masterBytes: existsSync(join(root, "media/dnabg-4k.mov"))
        ? statSync(join(root, "media/dnabg-4k.mov")).size
        : null,
};

if (report.mp4.bytes > 12 * 1024 * 1024) {
    throw new Error(`dnabg.mp4 is ${report.mp4.mb}MB; keep the homepage loop under 12MB`);
}
if (report.webm.bytes > 6 * 1024 * 1024) {
    throw new Error(`dnabg.webm is ${report.webm.mb}MB; keep the VP9 fallback under 6MB`);
}

console.log(JSON.stringify(report, null, 2));
