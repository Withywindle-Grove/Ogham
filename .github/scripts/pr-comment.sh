#!/usr/bin/env bash
# Posts one marked comment on a pull request, or updates it if this workflow already posted one, so each kind of
# automatic comment (the review, the CI triage) stays a single comment that changes with each run.
# Usage: bash .github/scripts/pr-comment.sh <pull request number> <marker> <file with the comment text>
# Needs GH_TOKEN (pull-requests: write) and GITHUB_REPOSITORY, both set in the calling step.
set -euo pipefail
pr="$1"
marker="<!-- $2 -->"
body="$marker
$(cat "$3")"
id=$(gh api --paginate "repos/$GITHUB_REPOSITORY/issues/$pr/comments" \
  --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"$marker\"))) | .id" | tail -n1)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" > /dev/null
  echo "Updated comment $id on pull request #$pr."
else
  gh api -X POST "repos/$GITHUB_REPOSITORY/issues/$pr/comments" -f body="$body" > /dev/null
  echo "Posted a comment on pull request #$pr."
fi
