// Markdown (the shapes used by templates/) to Atlassian Document Format, which
// the Jira Cloud REST API v3 needs for descriptions and comments. Covers what
// the templates use: paragraphs, **bold**, `code`, bullet lists (nested by two
// spaces), numbered lists and tables. Anything else stays plain text.
type Node = { type: string; [key: string]: unknown };

function inline(text: string): Node[] {
  const nodes: Node[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean)) {
    if (part.startsWith('**')) nodes.push({ type: 'text', text: part.slice(2, -2), marks: [{ type: 'strong' }] });
    else if (part.startsWith('`')) nodes.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'code' }] });
    else nodes.push({ type: 'text', text: part });
  }
  return nodes;
}

const paragraph = (text: string): Node => ({ type: 'paragraph', content: inline(text) });

type Item = { indent: number; text: string };

// Builds a list from items; deeper-indented items become a nested bullet list.
function list(type: 'bulletList' | 'orderedList', items: Item[]): Node {
  const content: Node[] = [];
  const base = items[0].indent;
  for (let i = 0; i < items.length; ) {
    const children: Item[] = [];
    let j = i + 1;
    while (j < items.length && items[j].indent > base) children.push(items[j++]);
    const item: Node[] = [paragraph(items[i].text)];
    if (children.length) item.push(list('bulletList', children));
    content.push({ type: 'listItem', content: item });
    i = j;
  }
  return { type, content };
}

function table(rows: string[]): Node {
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const body = rows.filter((r) => !/^\s*\|[\s:|-]+\|\s*$/.test(r));
  return {
    type: 'table',
    content: body.map((row, i) => ({
      type: 'tableRow',
      content: cells(row).map((c) => ({ type: i === 0 ? 'tableHeader' : 'tableCell', content: [paragraph(c)] })),
    })),
  };
}

export function markdownToAdf(markdown: string): Node {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const content: Node[] = [];
  const bullet = /^(\s*)- (.*)$/;
  const numbered = /^(\s*)\d+\. (.*)$/;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.trim().startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      content.push(table(rows));
    } else if (bullet.test(line) || numbered.test(line)) {
      const type = numbered.test(line) ? 'orderedList' : 'bulletList';
      const items: Item[] = [];
      while (i < lines.length && (bullet.test(lines[i]) || numbered.test(lines[i]))) {
        const m = (lines[i].match(bullet) ?? lines[i].match(numbered))!;
        // A numbered line at the left margin after bullets starts a new list.
        if (items.length && m[1].length === 0 && numbered.test(lines[i]) !== (type === 'orderedList')) break;
        items.push({ indent: m[1].length, text: m[2] });
        i++;
      }
      content.push(list(type, items));
    } else {
      content.push(paragraph(line.trim()));
      i++;
    }
  }
  return { type: 'doc', version: 1, content };
}
