# Manual checks: guard-new-tests-editable (gd-1)

The guard runs inside Claude Code, so these are checks for the next fix- branch, not for the app. No gallery picture changes: nothing on screen moves.

1. On the next `fix-` branch, ask the builder to add a new test without `.fails` and change it once before committing. You should see no "Blocked" message.
2. Ask it to change a line in a test that was already in the file before the branch. You should see "Blocked: … is a test file and this is the fix branch …", with the line "A test not in a commit yet may be changed freely (gd-1)".
3. After the builder's first commit (the tests alone, marked `.fails`), ask it to change that new test's body. You should see "Blocked" again: from that commit on the old rule holds.
4. In the pull request, look for each new test's real failure message, run once without `.fails` (the second condition of gd-1).
