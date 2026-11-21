// A valid entry id in a pack file: lowercase letters, digits and dashes. Its own file so the pack reader
// (packFile.ts) and the adventure hooks' reader (adventureHooks.ts), which packFile.ts uses, share it without a cycle.
export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
