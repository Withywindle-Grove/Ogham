// A rule's text in the book's words, set out as the pack gives it (paragraphs with their bold lead-ins, sub-headings,
// lists, a titled table, a boxed aside, the source line); nothing written by the app. Made for a place's rules (December
// dec-7 piece 3; #783) and moved here to be shared (dec-8 B, mm-12: the Magic tab's opened spell).
// A trait's note in blocks (tfb-5, row C9) is drawn here too, inside its entry (`EntryPanel`, src/ui/creation.tsx).
import { blocksOfRead, type RuleBlock } from '../modules/expedition/placeRules.ts';
import type { RuleTextBlocks } from '../modules/library/ruleText.ts';
import './RuleText.css';

/**
 * A rule's text as its book sets it out; every block drawn, nothing dropped (mc-34). Given its drawn `blocks`, or a
 * `text` the shared reader read (readRuleText or readTraitNote, src/modules/library/ruleText.ts), turned into blocks by
 * `blocksOfRead`. `className` adds the host's spacing (an entry's paragraph gap in the book format).
 */
export function RuleText(props: { blocks: readonly RuleBlock[]; className?: string } | { text: RuleTextBlocks; className?: string }) {
  const blocks = 'blocks' in props ? props.blocks : blocksOfRead(props.text);
  return <div className={props.className ? `rule-text ${props.className}` : 'rule-text'}>{blocks.map(ruleBlock)}</div>;
}

/**
 * One block. A boxed aside (pf-18 `box`; mockup december/01 frame 7b, approved 2026-11-12) is a bordered box inside the
 * text, its title bold and its blocks in the text face; a numbered list keeps its numbers.
 */
function ruleBlock(block: RuleBlock, i: number) {
  if (block.kind === 'h') return <h4 key={i} className="rule-text__heading">{block.text}</h4>;
  if (block.kind === 'list') {
    const Items = block.numbered ? 'ol' : 'ul';
    return (
      <Items key={i} className="rule-text__list">
        {block.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </Items>
    );
  }
  if (block.kind === 'box')
    return (
      <div key={i} className="rule-text__box">
        {block.title && <p className="rule-text__box-title">{block.title}</p>}
        {block.blocks.map(ruleBlock)}
      </div>
    );
  if (block.kind === 'source') return <p key={i} className="rule-text__source">{block.text}</p>;
  if (block.kind === 'table')
    return (
      <div key={i} className="rule-text__table-wrap">
        <table className="rule-text__table">
          {block.title && <caption>{block.title}</caption>}
          {block.columns.some(Boolean) && (
            <thead>
              <tr>
                {block.columns.map((c, j) => (
                  <th key={j} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map((row, j) => (
              <tr key={j}>
                {row.map((cell, k) => (
                  <td key={k}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <p key={i} className="rule-text__p">
      {block.lead && <strong>{`${block.lead}${/[.:!?]$/.test(block.lead) ? '' : '.'} `}</strong>}
      {block.text}
    </p>
  );
}
