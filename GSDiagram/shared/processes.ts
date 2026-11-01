// Reads the processes from a Markdown file. A process is a list item that starts with its id and title in bold:
//   - **INVO10 Send an invoice.** On the detail, press Send; its draft is booked.

import { DEFAULT_ID_PATTERN, Process } from './types';

export function readProcesses(md: string, idPattern = DEFAULT_ID_PATTERN): Map<string, Process> {
  const item = new RegExp(`^\\s*[-*]\\s+\\*\\*(${idPattern})\\s+([^*]+?)\\*\\*\\s*(.*)$`);
  const found = new Map<string, Process>();
  let group = '';
  md.split(/\r?\n/).forEach((text, line) => {
    const heading = /^#{1,6}\s+(.*)$/.exec(text);
    if (heading) { group = heading[1].trim(); return; }
    const m = item.exec(text);
    if (m && !found.has(m[1])) found.set(m[1], { id: m[1], title: m[2].replace(/\.$/, ''), text: m[3], group, line });
  });
  return found;
}
