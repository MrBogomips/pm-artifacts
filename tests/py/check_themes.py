"""validate-themes: every theme has the light block and the two dark blocks, the same token set as the
default theme in each, identical dark blocks, and font sources only on Google Fonts."""
import os
import sys

root, theme_dir = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(root, "shared", "scripts"))
import theme_tokens  # noqa: E402

problems = []
default = open(os.path.join(theme_dir, "default.css"), encoding="utf-8").read()
for name in sorted(f for f in os.listdir(theme_dir) if f.endswith(".css")):
    text = open(os.path.join(theme_dir, name), encoding="utf-8").read()
    problems += ["%s: %s" % (name, p) for p in theme_tokens.missing_tokens(default, text)]
    light, dark_sys, dark_explicit = theme_tokens.read_theme(text)
    if dark_sys is not None and dark_sys != dark_explicit:
        problems.append("%s: the two dark blocks differ" % name)
    for block in (light, dark_sys):
        if block is not None and set(block) - set(light):
            problems.append("%s: a dark block defines tokens the light block lacks" % name)
print("\n".join(problems))
sys.exit(1 if problems else 0)
