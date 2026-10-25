// Fake private Supabase Storage for QA: one private bucket holding the QA book. Read-only.
import http from 'node:http';
import fs from 'node:fs';
const pdf = fs.readFileSync(new URL('./qa-book.pdf', import.meta.url));
http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer qa-service-key') { res.writeHead(401); return res.end(); }
  if (req.url === '/storage/v1/bucket/qa-textbooks') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: 'qa-textbooks', public: false })); }
  if (req.url.startsWith('/storage/v1/object/info/qa-textbooks/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ size: pdf.length })); }
  if (req.url.startsWith('/storage/v1/object/authenticated/qa-textbooks/documents/')) { res.writeHead(200, { 'content-type': 'application/pdf' }); return res.end(pdf); }
  res.writeHead(404); res.end();
}).listen(54321, '127.0.0.1');
