# Manual checks: sn-1b-pinned-source

On the pull request's Vercel preview (test project), in a campaign with the rules pack and a conversion pack attached, where the conversion holds its own version of a class beside a pinned copy of the rules pack's class of the same name (`"pinnedFrom": "<the rules pack's meta id>"`).

1. As a player, Create your character → Guided, to the Kindred step: a kindred with a pinned twin shows two rows of one name, the pinned one ending "From <rules pack's short name>", the other "From <conversion's short name>".
2. Pick one; on the Class step the same for each twinned class. A screen reader's name for each Pick button ends "(from <pack>)".
3. A class with no twin shows no From line.
4. Finish and send; on the review, the class and kindred lines read "<name> (from <pack>)".
5. Open an approved character with a pinned class: the sheet's line under the name reads "<class> <level> (from <rules pack's short name>)".
