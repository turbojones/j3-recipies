#!/usr/bin/env python3
"""Generate short MP4 walkthroughs + WebVTT for every recipe (identical template)."""
from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "j3-brand.jpg"
OUT_DIR = ROOT / "public" / "walkthroughs"
RECIPES_JSON = Path(__file__).resolve().parent / "recipes-export.json"

W, H = 960, 540
FPS = 24
CRF = 28

# Identical timing for every recipe
DUR_TITLE = 4.0
DUR_ING = 4.0
DUR_SECTION = 3.0
DUR_STEP = 4.0
DUR_END = 3.0
MAX_STEP_SLIDES = 12  # after title+ing; tips skipped → keeps totals similar

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
INTER = "/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf"
if Path(INTER).exists():
    FONT_REG = INTER
    FONT_BOLD = INTER


def is_list_heading(item: str) -> bool:
    return bool(re.match(r"^[A-Za-z][A-Za-z0-9 &-]{0,40}:$", item.strip()))


def list_heading_label(item: str) -> str:
    return item.strip().rstrip(":")


def is_tip(text: str) -> bool:
    return bool(re.match(r"^tip:\s*", text.strip(), re.I))


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    words = text.split()
    if not words:
        return []
    lines: list[str] = []
    cur = words[0]
    for w in words[1:]:
        trial = f"{cur} {w}"
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size=size)
    except OSError:
        return ImageFont.load_default()


def make_overlay(lines_blocks: list[tuple[str, str]], accent: str | None = None) -> Image.Image:
    """Transparent PNG with bottom caption bar. blocks: list of (style, text) style in kicker|title|body|meta."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font_kicker = load_font(FONT_BOLD, 22)
    font_title = load_font(FONT_BOLD, 40)
    font_body = load_font(FONT_REG, 26)
    font_meta = load_font(FONT_REG, 22)

    pad_x = 36
    max_text_w = W - pad_x * 2
    rendered: list[tuple[ImageFont.FreeTypeFont, str, tuple[int, int, int]]] = []

    for style, text in lines_blocks:
        if style == "kicker":
            font, color = font_kicker, (255, 214, 170)
            if accent == "tip":
                color = (255, 200, 120)
            wrapped = wrap_text(draw, text.upper(), font, max_text_w)
        elif style == "title":
            font, color = font_title, (255, 255, 255)
            wrapped = wrap_text(draw, text, font, max_text_w)
        elif style == "meta":
            font, color = font_meta, (220, 220, 220)
            wrapped = wrap_text(draw, text, font, max_text_w)
        else:
            font, color = font_body, (245, 245, 245)
            wrapped = wrap_text(draw, text, font, max_text_w)
        for line in wrapped:
            rendered.append((font, line, color))

    # Measure
    line_gap = 8
    heights = []
    for font, line, _ in rendered:
        bbox = draw.textbbox((0, 0), line, font=font)
        heights.append(bbox[3] - bbox[1])
    content_h = sum(heights) + line_gap * max(0, len(heights) - 1)
    bar_pad_y = 28
    bar_h = min(H - 40, content_h + bar_pad_y * 2)
    bar_top = H - bar_h

    # Dark semi-transparent bar
    bar = Image.new("RGBA", (W, bar_h), (0, 0, 0, 0))
    bar_draw = ImageDraw.Draw(bar)
    bar_draw.rectangle([0, 0, W, bar_h], fill=(12, 18, 28, 200))
    img.alpha_composite(bar, (0, bar_top))

    y = bar_top + bar_pad_y
    draw = ImageDraw.Draw(img)
    for (font, line, color), lh in zip(rendered, heights):
        draw.text((pad_x, y), line, font=font, fill=color + (255,))
        y += lh + line_gap

    return img


def build_slides(recipe: dict) -> list[dict]:
    slides: list[dict] = []
    meta = f"{recipe['cookTimeMinutes']} min · {recipe['servings']} servings · {recipe['cuisine']}"
    slides.append(
        {
            "dur": DUR_TITLE,
            "vtt": f"{recipe['title']}. {meta}",
            "blocks": [
                ("kicker", "J3 Recipes"),
                ("title", recipe["title"]),
                ("meta", meta),
            ],
        }
    )

    real_ings = [i for i in recipe["ingredients"] if not is_list_heading(i)]
    preview = real_ings[:6]
    ing_lines = [f"• {x}" for x in preview]
    more = len(real_ings) - len(preview)
    blocks = [
        ("kicker", "Ingredients"),
        ("title", f"{len(real_ings)} ingredient{'s' if len(real_ings) != 1 else ''}"),
    ]
    for line in ing_lines:
        blocks.append(("body", line))
    if more > 0:
        blocks.append(("meta", f"+{more} more on the recipe page"))
    slides.append({"dur": DUR_ING, "vtt": f"Ingredients: {len(real_ings)}. " + "; ".join(preview[:4]), "blocks": blocks})

    step_n = 0
    step_slides = 0
    for raw in recipe["steps"]:
        if step_slides >= MAX_STEP_SLIDES:
            break
        if is_list_heading(raw):
            label = list_heading_label(raw)
            slides.append(
                {
                    "dur": DUR_SECTION,
                    "vtt": f"Section: {label}",
                    "blocks": [("kicker", "Section"), ("title", label)],
                }
            )
            step_slides += 1
            continue
        if is_tip(raw):
            continue  # skip tips for consistent length
        step_n += 1
        text = raw.strip()
        slides.append(
            {
                "dur": DUR_STEP,
                "vtt": f"Step {step_n}. {text}",
                "blocks": [("kicker", f"Step {step_n}"), ("body", text)],
            }
        )
        step_slides += 1

    slides.append(
        {
            "dur": DUR_END,
            "vtt": "You're ready. Use Make It for checkboxes on the page.",
            "blocks": [
                ("kicker", "Done"),
                ("title", "You're ready"),
                ("meta", "Use Make It for checkboxes on the page."),
            ],
        }
    )
    return slides


def render_clip(brand_scaled: Path, overlay_png: Path, out_mp4: Path, duration: float, zoom_start: float) -> None:
    frames = max(1, int(round(duration * FPS)))
    # Identical Ken Burns pattern: gentle zoom + slight pan, same delta every clip
    # z goes zoom_start -> zoom_start+0.10 over the clip
    z0 = zoom_start
    z1 = zoom_start + 0.10
    # zoompan uses 'on' = output frame number
    z_expr = f"{z0}+({z1}-{z0})*on/{frames}"
    # Keep centered with tiny horizontal drift for motion
    x_expr = f"(iw/2-(iw/zoom/2))+((on/{frames})-0.5)*iw*0.04"
    y_expr = f"(ih/2-(ih/zoom/2))+((on/{frames})-0.5)*ih*0.02"
    vf = (
        f"[0:v]scale=3000:-1,zoompan=z='{z_expr}':x='{x_expr}':y='{y_expr}'"
        f":d={frames}:s={W}x{H}:fps={FPS}[bg];"
        f"[bg][1:v]overlay=0:0:format=auto,format=yuv420p"
    )
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-loop", "1", "-i", str(brand_scaled),
        "-i", str(overlay_png),
        "-filter_complex", vf,
        "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", str(CRF),
        "-pix_fmt", "yuv420p", "-an",
        "-movflags", "+faststart",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True)


def write_vtt(slides: list[dict], path: Path) -> None:
    lines = ["WEBVTT", ""]
    t = 0.0

    def ts(sec: float) -> str:
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = sec % 60
        return f"{h:02d}:{m:02d}:{s:06.3f}"

    for i, sl in enumerate(slides, 1):
        start, end = t, t + sl["dur"]
        lines.append(str(i))
        lines.append(f"{ts(start)} --> {ts(end)}")
        # Keep cue short for native track display
        cue = sl["vtt"]
        if len(cue) > 160:
            cue = cue[:157] + "…"
        lines.append(cue)
        lines.append("")
        t = end
    path.write_text("\n".join(lines), encoding="utf-8")


def concat_clips(clips: list[Path], out_mp4: Path) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        for c in clips:
            f.write(f"file '{c}'\n")
        list_path = f.name
    try:
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", list_path,
            "-c", "copy",
            "-movflags", "+faststart",
            str(out_mp4),
        ]
        subprocess.run(cmd, check=True)
    finally:
        Path(list_path).unlink(missing_ok=True)


def process_recipe(recipe: dict, brand_work: Path) -> tuple[Path, Path, float, int]:
    slides = build_slides(recipe)
    rid = recipe["id"]
    work = Path(tempfile.mkdtemp(prefix=f"wt-{rid}-"))
    clips: list[Path] = []
    try:
        for i, sl in enumerate(slides):
            overlay = make_overlay(sl["blocks"])
            ov_path = work / f"ov-{i:03d}.png"
            overlay.save(ov_path)
            clip = work / f"clip-{i:03d}.mp4"
            # Same zoom start band for every recipe: oscillate slightly by index for variety within template
            z0 = 1.05 + (i % 3) * 0.03
            render_clip(brand_work, ov_path, clip, sl["dur"], z0)
            clips.append(clip)

        out_mp4 = OUT_DIR / f"{rid}.mp4"
        out_vtt = OUT_DIR / f"{rid}.vtt"
        concat_clips(clips, out_mp4)
        write_vtt(slides, out_vtt)
        size = out_mp4.stat().st_size
        total = sum(s["dur"] for s in slides)
        return out_mp4, out_vtt, total, size
    finally:
        shutil.rmtree(work, ignore_errors=True)


def prepare_brand() -> Path:
    """Pre-scale brand to a working JPEG for faster zoompan."""
    img = Image.open(BRAND).convert("RGB")
    # Cover a 3000px-wide canvas proportionally
    target_w = 3000
    scale = target_w / img.width
    img = img.resize((target_w, int(img.height * scale)), Image.Resampling.LANCZOS)
    path = Path(tempfile.mkdtemp(prefix="brand-")) / "brand.jpg"
    img.save(path, quality=90)
    return path


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    recipes = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))
    brand_path = prepare_brand()
    print(f"Generating {len(recipes)} walkthroughs…")
    sizes = []
    durs = []
    try:
        for r in recipes:
            mp4, vtt, dur, size = process_recipe(r, brand_path)
            sizes.append(size)
            durs.append(dur)
            print(f"  {r['id']}: {dur:.0f}s, {size/1024:.0f} KB → {mp4.name}")
    finally:
        shutil.rmtree(brand_path.parent, ignore_errors=True)

    avg = sum(sizes) / len(sizes) if sizes else 0
    print(f"Done. {len(sizes)} videos, avg {avg/1024:.0f} KB, avg duration {sum(durs)/len(durs):.0f}s")


if __name__ == "__main__":
    main()
