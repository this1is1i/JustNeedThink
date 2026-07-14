const readline = require('node:readline');

const port = process.env.JNT_PERMISSION_PORT;
const sessionId = process.env.JNT_SESSION_ID;
const tool = {
  name: 'request_permission',
  description: 'Ask the JustNeedThink desktop user to approve a Claude Code tool call.',
  inputSchema: {
    type: 'object',
    properties: { tool_name: { type: 'string' }, input: { type: 'object' } },
    required: ['tool_name', 'input'],
  },
};

function reply(id, result) { process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`); }
async function requestPermission(args) {
  const response = await fetch(`http://127.0.0.1:${port}/permission`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, toolName: args.tool_name, input: args.input }),
  });
  return await response.json();
}

readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on('line', async (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.method === 'initialize') {
    reply(message.id, { protocolVersion: message.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'justneedthink-permission', version: '1.0.0' } });
  } else if (message.method === 'tools/list') {
    reply(message.id, { tools: [tool] });
  } else if (message.method === 'tools/call') {
    try {
      const decision = await requestPermission(message.params?.arguments || {});
      reply(message.id, { content: [{ type: 'text', text: JSON.stringify(decision) }] });
    } catch (error) {
      reply(message.id, { content: [{ type: 'text', text: JSON.stringify({ behavior: 'deny', message: String(error) }) }], isError: true });
    }
  }
});
