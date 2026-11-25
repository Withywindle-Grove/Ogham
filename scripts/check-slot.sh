#!/bin/bash
# Runs a command (a full check, or a commit whose hook runs it) in a check slot, so a cloud container runs at most
# OGHAM_CHECK_SLOTS of them at once (default 1). Logs each run's slot, start, end and seconds to /tmp/ogham-check-times.log.
# Usage: scripts/check-slot.sh git commit -m "..."   or   scripts/check-slot.sh npm run check
# Why one: four at once on four cores made tests time out; two at once (Francis's trial, 24 Nov) still timed out the
# Scene UI tests, so back to one (docs/09-decisions-log.md, [process], 24 Nov). OGHAM_CHECK_SLOTS=2 allows a second.
LOG=/tmp/ogham-check-times.log
SLOTS=(/tmp/ogham-check.lock /tmp/ogham-check-2.lock)
[ "${OGHAM_CHECK_SLOTS:-1}" = "1" ] && SLOTS=(/tmp/ogham-check.lock)
while :; do
  for s in "${SLOTS[@]}"; do
    exec 9>>"$s"
    if flock -n 9; then
      start=$(date +%s)
      echo "$(date -u +%T) start ${s##*/} $PWD $*" >>"$LOG"
      "$@"
      rc=$?
      echo "$(date -u +%T) end ${s##*/} rc=$rc secs=$(($(date +%s) - start)) $PWD" >>"$LOG"
      exit $rc
    fi
    exec 9>&-
  done
  sleep 5
done
