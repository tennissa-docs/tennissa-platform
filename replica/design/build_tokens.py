#!/usr/bin/env python3
"""Generate tokens.css (CSS custom properties + Tailwind v4 @theme mapping) from tokens.json.

    python3 build_tokens.py tokens.json > tokens.css

Components use Tailwind classes such as bg-surface, text-muted, rounded-lg, shadow-card,
never raw hex values. replica-brand edits tokens.json and re-runs this script.
"""
import json
import sys


def main(path):
    t = json.load(open(path))
    out = ["/* Generated from tokens.json by build_tokens.py. Do not edit by hand. */", ""]

    # 1. plain custom properties
    out.append(":root {")
    for k, v in t["color"].items():
        out.append(f"  --color-{k}: {v};")
    for k in ("sans", "display", "mono"):
        out.append(f"  --font-{k}: {t['font'][k]};")
    for k, v in t["type"].items():
        out.append(f"  --text-{k}: {v['size'] / 16:.4g}rem;")
        out.append(f"  --text-{k}--line-height: {v['line'] / v['size']:.4g};")
        out.append(f"  --text-{k}--font-weight: {v['weight']};")
        out.append(f"  --text-{k}--letter-spacing: {v['tracking']};")
    for k, v in t["radius"].items():
        out.append(f"  --radius-{k}: {v}px;")
    for k, v in t["shadow"].items():
        out.append(f"  --shadow-{k}: {v};")
    for k, v in t["motion"].items():
        if not k.startswith("_"):
            out.append(f"  --motion-{k}: {v};")
    L = t["layout"]
    out.append(f"  --layout-content-max: {L['content-max']}px;")
    out.append(f"  --layout-reading-max: {L['reading-max']}px;")
    out.append(f"  --layout-form-max: {L['form-max']}px;")
    out.append(f"  --layout-sidebar: {L['sidebar']}px;")
    out.append(f"  --layout-header: {L['header']}px;")
    out.append(f"  --layout-gutter: {L['page-gutter']['mobile']}px;")
    out.append("}")
    out.append(f"@media (min-width: {L['breakpoints']['md']}px) {{ :root {{ --layout-gutter: {L['page-gutter']['tablet']}px; }} }}")
    out.append(f"@media (min-width: {L['breakpoints']['lg']}px) {{ :root {{ --layout-gutter: {L['page-gutter']['desktop']}px; }} }}")
    out.append("")

    # 2. Tailwind v4 theme mapping: utilities read the variables above
    out.append("/* Tailwind v4: @import \"tailwindcss\"; then this file. */")
    out.append("@theme inline {")
    for k in t["color"]:
        out.append(f"  --color-{k}: var(--color-{k});")
    for k in ("sans", "display", "mono"):
        out.append(f"  --font-{k}: var(--font-{k});")
    for k in t["type"]:
        for suffix in ("", "--line-height", "--font-weight", "--letter-spacing"):
            out.append(f"  --text-{k}{suffix}: var(--text-{k}{suffix});")
    for k in t["radius"]:
        out.append(f"  --radius-{k}: var(--radius-{k});")
    for k in t["shadow"]:
        out.append(f"  --shadow-{k}: var(--shadow-{k});")
    for name, px in L["breakpoints"].items():
        out.append(f"  --breakpoint-{name}: {px / 16:g}rem;")
    out.append("}")
    out.append("")

    # 3. base layer
    out.append("""html { font-family: var(--font-sans); color: var(--color-text); background: var(--color-bg);
  -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
.tabular, table, [data-money] { font-variant-numeric: tabular-nums; }
:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}""")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    sys.stdout.write(main(sys.argv[1] if len(sys.argv) > 1 else "tokens.json"))
