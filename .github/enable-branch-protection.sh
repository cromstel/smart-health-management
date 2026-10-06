#!/usr/bin/env bash
#
# Enables branch protection on the release branches.
#
# WHY THIS IS A SCRIPT AND NOT A CONFIG FILE: GitHub has no declarative,
# version-controllable format for branch protection that survives outside the
# repository UI or the API. It lives in repository settings. So the settings are
# checked in here as reviewable, executable intent -- change them here, re-run,
# and the diff shows exactly what changed about our own security posture.
#
# The required status check names MUST match the job names in
# .github/workflows/ci.yml exactly. GitHub silently drops a required check whose
# name no longer exists, which turns protection back into a suggestion with no
# error anywhere -- so the names below are asserted by the final step.
#
# USAGE
#   GITHUB_TOKEN=<a token with `repo` scope> REPO=cromstel/smart-health-management \
#     bash .github/enable-branch-protection.sh [branch ...]
#
# Defaults to main and the production hardening branch. This script needs the
# `Administration: read/write` permission on the repository.
#
# It is idempotent: PUT replaces the whole ruleset, so running it twice is
# harmless and running it after adding a check is how you add that check.

set -euo pipefail

REPO="${REPO:-cromstel/smart-health-management}"
BRANCHES=("${@:-main feat/production-hardening}")

if [ -z "${GITHUB_TOKEN:-}" ]; then
  cat >&2 <<'EOF'
GITHUB_TOKEN is not set.

Create a token with repository Administration: read/write:
  https://github.com/settings/tokens
Then:
  GITHUB_TOKEN=ghp_... bash .github/enable-branch-protection.sh
EOF
  exit 2
fi

API="https://api.github.com/repos/${REPO}"

# Names must match `name:` on the jobs in .github/workflows/ci.yml.
EXPECTED_CHECKS=("Frontend gates" "Backend gates" "Secret and policy scan")

checks_json() {
  local out="" sep=""
  for c in "${EXPECTED_CHECKS[@]}"; do
    out+="${sep}{\"context\":\"${c}\"}"
    sep=","
  done
  printf '%s' "${out}"
}

for branch in "${BRANCHES[@]}"; do
  echo "==> protecting ${branch}"

  cat <<EOF
{
  "branch": "${branch}",
  "enforce_admins": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "required_status_checks": {
    "strict": true,
    "contexts": [$(checks_json)]
  },
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": {
    "users": [],
    "teams": [],
    "apps": []
  }
}
EOF

  # PUT is the full replace: any check not listed here stops being required.
  # That is the behaviour we want, so a removed job cannot linger as a phantom.
  response=$(curl -sS -X PUT \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${API}/branches/${branch}/protection" \
    -d @-)

  echo "${response}" | grep -q '"branch"' \
    || { echo "failed to protect ${branch}:" >&2; echo "${response}" >&2; exit 1; }
done

# Verify rather than trust the write. A protection change that silently did not
# apply is indistinguishable from one that did, until the day it matters.
echo "==> verifying"
for branch in "${BRANCHES[@]}"; do
  live=$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "${API}/branches/${branch}/protection/required_status_checks")

  for c in "${EXPECTED_CHECKS[@]}"; do
    if ! grep -q "\"${c}\"" <<<"${live}"; then
      echo "ERROR: '${c}' is not required on ${branch}. Protection is weaker than intended." >&2
      exit 1
    fi
  done
  echo "    ${branch}: $(grep -o '"strict":[a-z]*' <<<"${live}" | head -1)"
done

echo "done."
cat <<'EOF'

Note on strict mode: "strict" means a branch must be up to date with its base
before merging, not merely that CI passed. That is deliberate for a clinical
system -- it stops a green run on last week's commit being read as evidence
about the commit being merged.
EOF