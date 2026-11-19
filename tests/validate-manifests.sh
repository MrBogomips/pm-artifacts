#!/usr/bin/env bash
# Manifest validity: plugin.json is the only manifest, with name, version (MAJOR.MINOR.PATCH),
# description, license and author. The plugin is distributed only through the mrbogomips
# marketplace (MrBogomips/claude-plugins), so the repository must not publish a marketplace.json.
set -u
. "$(dirname "$0")/lib.sh"
need jq

PLUGIN="${1:-$ROOT/.claude-plugin/plugin.json}"
P="${PLUGIN#"$ROOT"/}"

[ -f "$PLUGIN" ] || { fail "$P" "missing"; finish validate-manifests; }
jq -e . "$PLUGIN" >/dev/null 2>&1 || { fail "$P" "not valid JSON"; finish validate-manifests; }

for field in name version description license; do
    v=$(jq -r --arg f "$field" '.[$f] // "" | if type=="string" then . else "" end' "$PLUGIN")
    [ -n "$v" ] || fail "$P" "missing or empty \"$field\""
done
jq -e '(.author | type == "object") and ((.author.name // "") != "")' "$PLUGIN" >/dev/null 2>&1 \
    || fail "$P" "missing author with a name"

pver=$(jq -r '.version // ""' "$PLUGIN")
printf '%s' "$pver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || fail "$P" "version \"$pver\" is not MAJOR.MINOR.PATCH"

[ ! -e "$ROOT/.claude-plugin/marketplace.json" ] \
    || fail ".claude-plugin/marketplace.json" "must not exist: the plugin is listed only in the mrbogomips marketplace"

finish validate-manifests
