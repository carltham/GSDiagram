import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readProcesses } from '../shared/processes';

const md = `# User processes

## Invoices

- **INVO1 Read an invoice.** Choose a row; its detail opens beside the list.
- **INVO10 Send an invoice.** On the detail, press Send; its draft is booked.
- Not a process.

## Roles

- **Administrator.** Manages the users: INVO1.
`;

test('reads id, title, text, group and line', () => {
  const p = readProcesses(md);
  assert.deepEqual([...p.keys()], ['INVO1', 'INVO10']);
  assert.deepEqual(p.get('INVO10'), {
    id: 'INVO10', title: 'Send an invoice', text: 'On the detail, press Send; its draft is booked.', group: 'Invoices', line: 5,
  });
});

test('a role is not a process', () => {
  assert.equal(readProcesses(md).has('Administrator'), false);
});

test('the id pattern can be changed', () => {
  const p = readProcesses('- **P-12 Do it.** Now.', 'P-\\d+');
  assert.equal(p.get('P-12')?.title, 'Do it');
});
