#!/usr/bin/env bash
# Upgrades a workspace written by a real root image to the local image and checks that it
# stays intact and writable. Run before releasing a change to the Dockerfile or lib/privileges.ts.
set -u
export MSYS_NO_PATHCONV=1

OLD=ghcr.io/dexgamedev/wikindie:0.7.7
NEW=wikindie:upgrade-check
C=wikindie-upgrade-check
V=wikindie-upgrade-check
PORT=3917
URL=http://127.0.0.1:$PORT/api
FAILS=0

cleanup() { docker rm -fv "$C" >/dev/null 2>&1; docker volume rm "$V" >/dev/null 2>&1; }
trap cleanup EXIT
check() { if [ "$2" = "$3" ]; then echo "  ok    $1"; else echo "  FAIL  $1: expected [$3], got [$2]"; FAILS=$((FAILS + 1)); fi; }

# The VPS shape by default: volume at /app/space, SPACE_DIR unset, started as root.
start() { # image, extra docker run args...
  local image=$1; shift
  docker rm -fv "$C" >/dev/null 2>&1
  docker run -d --name "$C" -p 127.0.0.1:$PORT:3000 -v "$V:/app/space" \
    -e WIKINDIE_USER=check:check-password -e JWT_SECRET=upgrade-check-secret "$@" "$image" >/dev/null
  for _ in $(seq 1 30); do curl -sf "$URL/health" >/dev/null && return 0; sleep 1; done
  echo "  FAIL  $image did not start:"; docker logs "$C" 2>&1 | tail -5; FAILS=$((FAILS + 1)); return 1
}
login() { curl -s -H 'Content-Type: application/json' -d '{"username":"check","password":"check-password"}' "$URL/auth/login" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }
status() { curl -s -w '%{http_code}' "$@" | tail -c 3; }
sums() { docker run --rm -v "$V:/data:ro" alpine sh -c 'cd /data && find . -type f ! -name "*.log" | sort | xargs -r sha256sum' | sha256sum; }
writes() { # name
  local T; T=$(login); [ -n "$T" ] || { check "$1: login" none token; return; }
  check "$1: create page" "$(status -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d "{\"name\":\"$1\"}" "$URL/pages")" 201
  check "$1: save page" "$(status -X PUT -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"content":"edited"}' "$URL/page/$1")" 200
  local ID; ID=$(curl -s -H "Authorization: Bearer $T" "$URL/page/$1" | grep -o 'pg_[A-Za-z0-9_-]*' | head -1)
  check "$1: upload image" "$(status -H "Authorization: Bearer $T" -H 'Content-Type: image/png' --data-binary 'png' "$URL/attachments/$ID?filename=a.png")" 201
}
owners() { docker run --rm -v "$V:/data:ro" alpine sh -c 'find /data ! -type l -exec stat -c "%u:%g" {} + | sort -u | tr "\n" " "' | sed 's/ $//'; }
thread_uids() { docker exec "$C" sh -c 'cat /proc/1/task/*/status' | awk '/^Uid:/ {print $2 ":" $3 ":" $4 ":" $5}' | sort -u | tr '\n' ' ' | sed 's/ $//'; }

docker build -q -t "$NEW" . >/dev/null || exit 1
cleanup

echo "Seed with the old root image"
start "$OLD" || exit 1
writes Seed
docker run --rm -v "$V:/data" alpine sh -c 'ln -s /etc/hostname /data/outside-link; chmod 600 /data/_AGENT.md'
check "seed is root-owned" "$(owners)" "0:0"
BEFORE=$(sums)

echo "Upgrade, started as root with default capabilities"
start "$NEW" || exit 1
check "every thread runs as node" "$(thread_uids)" "1000:1000:1000:1000"
check "can never regain root" "$(docker exec -u 1000 "$C" sh -c 'grep CapEff /proc/1/status' | awk '{print $2}')" "0000000000000000"
check "workspace owned by node" "$(owners)" "1000:1000"
check "file contents unchanged" "$(sums)" "$BEFORE"
check "symlink target untouched" "$(docker exec "$C" stat -Lc %u /app/space/outside-link)" "0"
check "ownership change logged" "$(docker logs "$C" 2>&1 | grep -c 'Changed the owner')" "1"
writes Upgraded

echo "Restart finds nothing to change"
start "$NEW" || exit 1
check "no ownership change logged" "$(docker logs "$C" 2>&1 | grep -c 'Changed the owner')" "0"

echo "Hardened start with --user: no migration"
start "$NEW" --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges:true --read-only --tmpfs /tmp || exit 1
check "runs as node from the start" "$(thread_uids)" "1000:1000:1000:1000"
writes Hardened

echo "Rollback to the old root image"
start "$OLD" || exit 1
writes Rollback

echo "Back to root ownership, with no capabilities to change it"
docker rm -fv "$C" >/dev/null 2>&1
docker run --rm -v "$V:/data" alpine chown -R 0:0 /data
start "$NEW" --cap-drop ALL || exit 1
check "stays root" "$(thread_uids)" "0:0:0:0"
check "warning logged" "$(docker logs "$C" 2>&1 | grep -c 'still running as root')" "1"
writes NoCaps

echo
[ "$FAILS" -eq 0 ] && echo "All checks passed." || echo "$FAILS checks failed."
exit "$FAILS"
