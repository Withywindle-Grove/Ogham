// A name in a sentence's words (words rule 13, docs/06; Francis, 26 Nov, #50 audit finding 7, replacing wd-1). Here in
// core so the log (events.ts), the screens and the modules write a name one way; the inventory module re-exports them
// (packView.ts), where they were first written.

/** "the " and a name, in a sentence's words ("the Bronze ring"); a name that starts with "The" keeps its own ("The Old Lantern"). */
export const withThe = (name: string) => (/^the\s/i.test(name) ? name : `the ${name}`);

/** A name's possessive, in a sentence's words: "Wren’s pack", and after a final s the mark alone, "the Lantern Wardens’ pack". */
export const possessive = (name: string) => (/s$/i.test(name) ? `${name}’` : `${name}’s`);

/** The same at a sentence's start: "The Bronze ring is full.", and "The Old Satchel is full." (never "The The …"). */
export const withTheStart = (name: string) => {
  const words = withThe(name);
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
};
