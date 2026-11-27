#!/bin/bash
# Runs a command (a full check, or a commit whose hook runs it) in a check slot, so a cloud container runs at most
# OGHAM_CHECK_SLOTS of them at once (default 1). Logs each run's slot, start, end and seconds to /tmp/ogham-check-times.log.
# Usage: scripts/check-slot.sh git commit -m "..."   or   scripts/check-slot.sh npm run check
# Why one: four at once on four cores made tests time out; two at once (Francis's trial, 24 Nov) still timed out the
# Scene UI tests, so back to one (docs/09-decisions-log.md, [process], 24 Nov). OGHAM_CHECK_SLOTS=2 allows a second.
# Where `flock` is missing (Windows Git Bash), a slot is a lock directory (`<lock>.d`, made with an atomic mkdir and
# holding the owner's PID), removed on exit; one whose owner has gone (a hard kill) is cleared by the next run
# (docs/09-decisions-log.md, [process], 27 Nov). OGHAM_CHECK_TMP moves the locks and the log (for testing only).
TMPD=${OGHAM_CHECK_TMP:-/tmp}
LOG=$TMPD/ogham-check-times.log
SLOTS=("$TMPD/ogham-check.lock" "$TMPD/ogham-check-2.lock")
[ "${OGHAM_CHECK_SLOTS:-1}" = "1" ] && SLOTS=("$TMPD/ogham-check.lock")

run() { # $1 = the slot; runs the rest, logs it, exits with its code
  local s=$1
  shift
  start=$(date +%s)
  echo "$(date -u +%T) start ${s##*/} $PWD $*" >>"$LOG"
  "$@"
  rc=$?
  echo "$(date -u +%T) end ${s##*/} rc=$rc secs=$(($(date +%s) - start)) $PWD" >>"$LOG"
  exit $rc
}

if command -v flock >/dev/null 2>&1; then
  while :; do
    for s in "${SLOTS[@]}"; do
      exec 9>>"$s"
      if flock -n 9; then run "$s" "$@"; fi
      exec 9>&-
    done
    sleep 5
  done
fi

# No flock: one lock directory per slot.
clear_stale() { # $1 = a lock directory; removes it only if the PID inside names a process that has gone
  local d=$1 pid
  pid=$(cat "$d/pid" 2>/dev/null) || return
  [ -n "$pid" ] || return # being taken this moment: leave it
  kill -0 "$pid" 2>/dev/null && return
  [ "$(cat "$d/pid" 2>/dev/null)" = "$pid" ] || return # retaken since we looked
  rm -rf "$d"
  echo "$(date -u +%T) cleared stale ${d##*/} pid=$pid" >>"$LOG"
}
while :; do
  for s in "${SLOTS[@]}"; do
    d=$s.d
    if mkdir "$d" 2>/dev/null; then
      trap 'rm -rf "$d"' EXIT
      trap 'exit 130' INT
      trap 'exit 143' TERM
      trap 'exit 129' HUP
      echo $$ >"$d/pid"
      run "$s" "$@"
    fi
    clear_stale "$d"
  done
  sleep 5
done
