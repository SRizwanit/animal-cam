#!/usr/bin/env python3
"""
Universal Video Kit — Python অর্কেস্ট্রেটর
==========================================
ধাপ:
  1. ইনপুট ভিডিও probe করা
  2. seed বানানো (ফাইলের নাম + Day + salt) → প্রতিটি ভিডিওর জন্য আলাদা, কিন্তু একই ইনপুটে সবসময় একই ফল
  3. forward (fwd.mp4) ও reverse (rev.mp4) ক্লিপ বানানো (FFmpeg)
  4. থাম্বনেইলের ফ্রেম + সবচেয়ে ফাঁকা কোণ খোঁজা (numpy/Pillow)
  5. props.json লেখা → Remotion (React) দিয়ে রেন্ডার
  6. মেটাডাটা + report.json (SHA-256) বসানো
"""
import argparse, hashlib, json, math, random, re, shutil, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REMOTION = HERE / "remotion"
PUBLIC = REMOTION / "public"

SIZES = {  # (landscape W,H)
    "4k": (3840, 2160),
    "1080p": (1920, 1080),
    "720p": (1280, 720),
}
CRF = {"fast": 20, "balanced": 16, "max": 12}


def run(cmd, **kw):
    print("▶", " ".join(map(str, cmd)), flush=True)
    return subprocess.run(list(map(str, cmd)), check=True, **kw)


def probe(src: Path) -> dict:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(src)]
    )
    j = json.loads(out)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in j["streams"])
    n, d = (v.get("avg_frame_rate") or "30/1").split("/")
    fps = float(n) / float(d) if float(d) else 30.0
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    return {
        "w": w, "h": h, "fps": fps, "has_audio": has_audio,
        "dur": float(j["format"]["duration"]),
    }


def make_seed(stem: str, day: str, salt: str) -> int:
    return int(hashlib.sha256(f"{stem}|{day}|{salt}".encode()).hexdigest()[:8], 16)


def unique_params(seed: int) -> dict:
    """seed থেকে সূক্ষ্ম কিন্তু আলাদা look বের করে। (ছোট রেঞ্জ — ভিডিও নষ্ট হয় না)"""
    r = random.Random(seed)
    tints = ["rgba(255,190,110,0.05)", "rgba(120,180,255,0.05)", "rgba(150,255,170,0.04)", "rgba(255,150,190,0.04)"]
    return {
        "seed": seed,
        "hue": round(r.uniform(-6, 6), 2),
        "saturate": round(r.uniform(1.02, 1.10), 3),
        "contrast": round(r.uniform(1.01, 1.06), 3),
        "brightness": round(r.uniform(0.98, 1.04), 3),
        "zoom": round(r.uniform(0.025, 0.055), 4),
        "driftSpeed": round(r.uniform(0.08, 0.2), 3),
        "driftPhase": round(r.uniform(0, 2 * math.pi), 3),
        "vignette": round(r.uniform(0.18, 0.38), 3),
        "grain": round(r.uniform(0.03, 0.07), 3),
        "tint": r.choice(tints),
        "introSec": round(r.uniform(2.0, 3.0), 2),
        "outroSec": round(r.uniform(1.5, 2.5), 2),
    }


def quietest_corner(img_path: Path) -> str:
    """চার কোণের মধ্যে যেটায় সবচেয়ে কম ডিটেইল (edge energy) — সেখানেই লেখা বসবে"""
    import numpy as np
    from PIL import Image

    im = Image.open(img_path).convert("L")
    im.thumbnail((640, 640))
    a = np.asarray(im, dtype="float32")
    gy, gx = np.gradient(a)
    e = np.hypot(gx, gy)
    h, w = e.shape
    ch, cw = int(h * 0.35), int(w * 0.45)
    zones = {
        "top-left": e[:ch, :cw], "top-right": e[:ch, -cw:],
        "bottom-left": e[-ch:, :cw], "bottom-right": e[-ch:, -cw:],
    }
    return min(zones, key=lambda k: float(zones[k].mean()))


def main():
    ap = argparse.ArgumentParser(description="Universal Video Kit")
    ap.add_argument("--src", required=True, help="ইনপুট ভিডিও (যেমন video/Day01.mp4)")
    ap.add_argument("--day", default="01")
    ap.add_argument("--duration", type=float, default=150, help="ফাইনাল দৈর্ঘ্য (সেকেন্ড)")
    ap.add_argument("--resolution", choices=list(SIZES), default="4k")
    ap.add_argument("--quality", choices=list(CRF), default="balanced")
    ap.add_argument("--audio", choices=["reverse_sync", "mute"], default="reverse_sync")
    ap.add_argument("--brand", default="Animal Cam")
    ap.add_argument("--salt", default="", help="একই ভিডিও থেকে আরেকটি আলাদা ভার্সন চাইলে salt বদলান")
    ap.add_argument("--out", default="output")
    ap.add_argument("--no-render", action="store_true", help="শুধু প্রস্তুতি (props.json + clips), রেন্ডার নয়")
    a = ap.parse_args()

    src = Path(a.src)
    out = Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    # 1) probe
    info = probe(src)
    portrait = info["h"] > info["w"]
    W, H = SIZES[a.resolution]
    if portrait:
        W, H = H, W
    fps = 30 if info["fps"] < 45 else 60
    print(f"ইনপুট: {info['w']}x{info['h']} {info['fps']:.2f}fps {info['dur']:.2f}s audio={info['has_audio']}")
    if info["dur"] > 120:
        print("⚠ ক্লিপ ১২০ সেকেন্ডের বেশি — রিভার্স করতে অনেক RAM লাগতে পারে", file=sys.stderr)

    # 2) seed
    seed = make_seed(src.stem, a.day, a.salt)
    params = unique_params(seed)
    print("seed =", seed)

    # 3) fwd / rev ক্লিপ (Remotion-friendly: CFR, yuv420p, faststart)
    use_audio = info["has_audio"] and a.audio == "reverse_sync"
    common = ["-r", fps, "-c:v", "libx264", "-preset", "veryfast", "-crf", 14,
              "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-g", fps]
    aud = ["-c:a", "aac", "-b:a", "192k", "-ar", 48000] if use_audio else ["-an"]
    run(["ffmpeg", "-y", "-v", "error", "-i", src, *common, *aud, PUBLIC / "fwd.mp4"])
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", "reverse",
         *(["-af", "areverse"] if use_audio else []), *common, *aud, PUBLIC / "rev.mp4"])
    clip = probe(PUBLIC / "fwd.mp4")["dur"]

    # 4) থাম্বনেইল ফ্রেম + ফাঁকা কোণ
    thumb = PUBLIC / "thumb.jpg"
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{clip * 0.4:.2f}", "-i", PUBLIC / "fwd.mp4",
         "-frames:v", 1, "-q:v", 2, thumb])
    corner = quietest_corner(thumb)

    # 5) props.json
    props = {
        "width": W, "height": H, "fps": fps,
        "durationSec": a.duration, "clipSec": round(clip, 3),
        "hasAudio": use_audio,
        "fwdSrc": "fwd.mp4", "revSrc": "rev.mp4", "thumbSrc": "thumb.jpg",
        "dayText": a.day, "brandText": a.brand, "badgeCorner": corner,
        **params,
    }
    props_path = out / "props.json"
    props_path.write_text(json.dumps(props, ensure_ascii=False, indent=2))
    print("props →", props_path)
    if a.no_render:
        return

    # 6) Remotion রেন্ডার
    if not (REMOTION / "node_modules").exists():
        run(["npm", "install", "--no-audit", "--no-fund"], cwd=REMOTION)
    raw = out / "raw.mp4"
    final = out / f"{re.sub(r'[^A-Za-z0-9_.-]', '_', src.stem)}_unique_{a.resolution}.mp4"
    thumb_out = out / f"{final.stem}_thumbnail.jpg"
    base = ["npx", "remotion"]
    run([*base, "render", "src/index.ts", "UniqueVideo", raw, f"--props={props_path}",
         "--codec=h264", f"--crf={CRF[a.quality]}", "--concurrency=100%", "--log=warn"], cwd=REMOTION)
    run([*base, "still", "src/index.ts", "Thumbnail", thumb_out, f"--props={props_path}",
         "--image-format=jpeg", "--jpeg-quality=95", "--log=warn"], cwd=REMOTION)

    # 7) মেটাডাটা + faststart
    run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-c", "copy", "-movflags", "+faststart",
         "-metadata", f"title={a.brand} — Day {a.day}",
         "-metadata", f"comment=uvk-seed-{seed}", final])
    raw.unlink(missing_ok=True)

    sha = hashlib.sha256(final.read_bytes()).hexdigest()
    (out / "report.json").write_text(json.dumps(
        {"input": str(src), "output": final.name, "thumbnail": thumb_out.name, "seed": seed,
         "sha256": sha, "params": params, "corner": corner}, indent=2))
    print("✅ শেষ:", final, "| sha256", sha[:16], "…")


if __name__ == "__main__":
    main()
