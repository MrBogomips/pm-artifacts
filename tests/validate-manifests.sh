#!/usr/bin/env bash
# Manifest validity and version sync: plugin.json is the source of truth; marketplace.json has
# exactly one entry, source "./", same name and version.
set -u
. "$(dirname "$0")/lib.sh"
need jq

PLUGIN="${1:-$ROOT/.claude-plugin/plugin.json}"
MARKET="${2:-$ROOT/.claude-plugin/marketplace.json}"
P="${PLUGIN#"$ROOT"/}"
M="${MARKET#"$ROOT"/}"

for f in "$PLUGIN" "$MARKET"; do
    [ -f "$f" ] || { fail "${f#"$ROOT"/}" "missing"; finish validate-manifests; }
    jq -e . "$f" >/dev/null 2>&1 || { fail "${f#"$ROOT"/}" "not valid JSON"; finish validate-manifests; }
done

for field in name version description license; do
    v=$(jq -r --arg f "$field" '.[$f] // "" | if type=="string" then . else "" end' "$PLUGIN")
    [ -n "$v" ] || fail "$P" "missing or empty \"$field\""
done
jq -e '(.author | type == "object") and ((.author.name // "") != "")' "$PLUGIN" >/dev/null 2>&1 \
    || fail "$P" "missing author with a name"

pver=$(jq -r '.version // ""' "$PLUGIN")
printf '%s' "$pver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || fail "$P" "version \"$pver\" is not MAJOR.MINOR.PATCH"

count=$(jq '.plugins | length' "$MARKET")
[ "$count" = "1" ] || fail "$M" "must list exactly one plugin, found $count"

pname=$(jq -r '.name // ""' "$PLUGIN")
mname=$(jq -r '.plugins[0].name // ""' "$MARKET")
msrc=$(jq -r '.plugins[0].source // ""' "$MARKET")
mver=$(jq -r '.plugins[0].version // ""' "$MARKET")

[ "$mname" = "$pname" ] || fail "$M" "entry name \"$mname\" differs from plugin.json name \"$pname\""
[ "$msrc" = "./" ] || fail "$M" "entry source is \"$msrc\", expected \"./\""
[ "$mver" = "$pver" ] || fail "$M" "version mismatch: marketplace \"$mver\" vs plugin.json \"$pver\""

finish validate-manifests
