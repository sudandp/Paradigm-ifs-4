import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownMessageProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

interface InlineNode {
  type: 'text' | 'bold' | 'code' | 'italic' | 'link' | 'strike';
  value?: string;
  text?: string;
  href?: string;
  children?: InlineNode[];
}

/**
 * Tokenize inline Markdown elements:
 * - [Link Label](url)
 * - **Bold Text**
 * - `Inline Code`
 * - *Italic Text*
 * - ~~Strikethrough~~
 */
function parseInlineTokens(text: string): InlineNode[] {
  // Regex matches:
  // 1 & 2: [label](url)
  // 3: **bold**
  // 4: `code`
  // 5: *italic*
  // 6: ~~strike~~
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|~~([^~]+)~~/g;
  let lastIndex = 0;
  const nodes: InlineNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }

    if (match[1] && match[2]) {
      nodes.push({ type: 'link', text: match[1], href: match[2] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: 'bold', children: parseInlineTokens(match[3]) });
    } else if (match[4] !== undefined) {
      nodes.push({ type: 'code', value: match[4] });
    } else if (match[5] !== undefined) {
      nodes.push({ type: 'italic', value: match[5] });
    } else if (match[6] !== undefined) {
      nodes.push({ type: 'strike', value: match[6] });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', value: text.substring(lastIndex) });
  }

  return nodes;
}

/**
 * Render inline tokens into React elements
 */
function renderInlineNodes(nodes: InlineNode[], keyPrefix = 'in', isUser = false): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;

    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;

      case 'bold':
        return (
          <strong
            key={key}
            className={
              isUser
                ? 'font-bold text-white'
                : 'font-bold text-slate-900 dark:text-white'
            }
          >
            {node.children ? renderInlineNodes(node.children, `${key}-b`, isUser) : ''}
          </strong>
        );

      case 'code':
        return (
          <code
            key={key}
            className={`px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[12px] font-semibold border ${
              isUser
                ? 'bg-emerald-700/60 border-emerald-500/40 text-emerald-100'
                : 'bg-slate-100 dark:bg-slate-800/90 border-slate-200/90 dark:border-slate-700/80 text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {node.value}
          </code>
        );

      case 'italic':
        return (
          <em key={key} className={isUser ? 'italic text-emerald-100' : 'italic text-slate-700 dark:text-slate-300'}>
            {node.value}
          </em>
        );

      case 'strike':
        return (
          <del key={key} className="line-through opacity-70">
            {node.value}
          </del>
        );

      case 'link': {
        const href = node.href || '#';
        const isExternal = href.startsWith('http');
        const isTel = href.startsWith('tel:');
        const isMail = href.startsWith('mailto:');

        return (
          <a
            key={key}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className={`font-semibold underline underline-offset-2 transition-all duration-150 inline-flex items-center gap-0.5 ${
              isUser
                ? 'text-white hover:text-emerald-200'
                : isTel || isMail
                ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
                : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
            }`}
          >
            {node.text}
          </a>
        );
      }

      default:
        return null;
    }
  });
}

function renderInlineString(text: string, isUser = false): React.ReactNode {
  const tokens = parseInlineTokens(text);
  return renderInlineNodes(tokens, 'str', isUser);
}

/**
 * Code Block component with one-click copy and automatic Mermaid diagram visual rendering
 */
function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const cleanLang = (lang || '').toLowerCase().trim();
  const isExplicitMermaid = cleanLang === 'mermaid' || cleanLang === 'flowchart' || cleanLang === 'graph';
  const hasDiagramKeywords = /^\s*(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie)\b/i.test(code.trim());
  const hasFlowArrows = (/->|-->|<-|<--/.test(code) && (code.match(/->|-->|<-|<--/g) || []).length >= 2);

  if (isExplicitMermaid || hasDiagramKeywords || hasFlowArrows) {
    return <MermaidDiagram code={code} title="Operational Flow Diagram" />;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-400 font-mono">
        <span className="uppercase tracking-wider font-semibold">{lang || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12px] font-mono leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Block =
  | { type: 'codeblock'; lang: string; content: string }
  | { type: 'diagram'; content: string }
  | { type: 'blockquote'; text: string }
  | { type: 'header'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'paragraph'; lines: string[] };

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code blocks (```)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({ type: 'codeblock', lang, content: codeLines.join('\n') });
      continue;
    }

    // 2. Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 3. Horizontal Rule (---, ***, ___)
    if (/^\s*(?:---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 4. Blockquotes (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    // 5. Headers (# Header)
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      blocks.push({ type: 'header', level: headerMatch[1].length, text: headerMatch[2] });
      i++;
      continue;
    }

    // 6. Tables (| Col 1 | Col 2 |)
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s\-:|]+\|\s*$/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      const rawRows = tableLines.map(l =>
        l
          .trim()
          .slice(1, -1)
          .split('|')
          .map(c => c.trim())
      );
      const headers = rawRows[0] || [];
      const rows = rawRows.slice(2); // Skip separator row
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // 7. Unordered List Items (•, -, *, +)
    // Note: ensure not just bold line starting with "**"
    const ulMatch = line.match(/^(\s*)(?:[•\-\+]|\*(?!\*))\s+(.*)$/);
    if (ulMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)(?:[•\-\+]|\*(?!\*))\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[2]);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // 8. Ordered List Items (1. , 2. )
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const itemMatch = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[2]);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // 9. Regular paragraph / multi-line text block
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].match(/^(#{1,6})\s+/) &&
      !lines[i].match(/^(\s*)(?:[•\-\+]|\*(?!\*))\s+/) &&
      !lines[i].match(/^(\s*)\d+\.\s+/) &&
      !isTableRow(lines[i]) &&
      !/^\s*(?:---|\*\*\*|___)\s*$/.test(lines[i])
    ) {
      pLines.push(lines[i]);
      i++;
    }

    if (pLines.length > 0) {
      const fullPText = pLines.join('\n');
      const arrowCount = (fullPText.match(/->|-->|<-|<--/g) || []).length;
      if (arrowCount >= 3) {
        blocks.push({ type: 'diagram', content: fullPText });
      } else {
        blocks.push({ type: 'paragraph', lines: pLines });
      }
    }
  }

  return blocks;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  className = '',
  isUser = false
}) => {
  if (!content) return null;

  const blocks = parseBlocks(content);

  return (
    <div className={`space-y-2.5 text-[13px] md:text-sm leading-relaxed ${className}`}>
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;

        switch (block.type) {
          case 'diagram':
            return <MermaidDiagram key={key} code={block.content} title="Process Flow Diagram" />;

          case 'codeblock':
            return <CodeBlock key={key} lang={block.lang} code={block.content} />;

          case 'blockquote':
            return (
              <blockquote
                key={key}
                className={`border-l-3 px-3.5 py-2 my-2 rounded-r-xl transition-colors ${
                  isUser
                    ? 'border-white/80 bg-emerald-700/50 text-white'
                    : 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-200 shadow-xs'
                }`}
              >
                {renderInlineString(block.text, isUser)}
              </blockquote>
            );

          case 'header': {
            const hText = renderInlineString(block.text, isUser);
            if (block.level === 1) {
              return (
                <h1 key={key} className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white mt-3 mb-1">
                  {hText}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2 key={key} className="text-base md:text-lg font-bold text-slate-900 dark:text-white mt-2.5 mb-1">
                  {hText}
                </h2>
              );
            }
            return (
              <h3 key={key} className="text-sm md:text-base font-bold text-slate-900 dark:text-white mt-2 mb-0.5">
                {hText}
              </h3>
            );
          }

          case 'ul':
            return (
              <ul key={key} className="space-y-1.5 my-2 pl-0.5">
                {block.items.map((item, itemIdx) => (
                  <li key={`${key}-li-${itemIdx}`} className="flex items-start gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${
                        isUser ? 'bg-white' : 'bg-emerald-500 dark:bg-emerald-400'
                      }`}
                    />
                    <div className="flex-1">{renderInlineString(item, isUser)}</div>
                  </li>
                ))}
              </ul>
            );

          case 'ol':
            return (
              <ol key={key} className="space-y-1.5 my-2 pl-1 list-decimal list-inside">
                {block.items.map((item, itemIdx) => (
                  <li key={`${key}-li-${itemIdx}`} className="pl-1">
                    <span>{renderInlineString(item, isUser)}</span>
                  </li>
                ))}
              </ol>
            );

          case 'table':
            return (
              <div key={key} className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <table className="min-w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th key={`th-${hIdx}`} className="px-3 py-2">
                          {renderInlineString(h, isUser)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {block.rows.map((row, rIdx) => (
                      <tr key={`tr-${rIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {row.map((cell, cIdx) => (
                          <td key={`td-${cIdx}`} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            {renderInlineString(cell, isUser)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'hr':
            return (
              <hr
                key={key}
                className={`my-3 border-t ${
                  isUser ? 'border-emerald-500/50' : 'border-slate-200 dark:border-slate-800'
                }`}
              />
            );

          case 'paragraph':
          default:
            return (
              <p key={key} className="leading-relaxed">
                {block.lines.map((l, lIdx) => (
                  <React.Fragment key={`${key}-l-${lIdx}`}>
                    {renderInlineString(l, isUser)}
                    {lIdx < block.lines.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
};
