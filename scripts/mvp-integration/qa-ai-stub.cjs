const http = require('node:http');

const port = Number(process.env.MVP_QA_AI_STUB_PORT || 8004);

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok', mode: 'mvp-int01-deterministic-stub' }));
    return;
  }

  if (request.method === 'POST' && request.url === '/api/v1/ai/steps/reason-turn') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      let input = {};
      try { input = JSON.parse(body || '{}'); } catch { /* schema validation remains in backend */ }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        message: 'He recibido tu contexto de Step 0. Contrastemos primero qué sabemos y qué falta por confirmar.',
        nextInteraction: { kind: 'ask', question: '¿Qué señal observable demostraría que el problema está bien delimitado?' },
        known: input.message ? ['Existe una aportación explícita de la persona en este turno.'] : [],
        unknown: ['La señal de éxito todavía requiere confirmación humana.'],
        contradictions: [],
        suggestions: [],
        warnings: ['Respuesta determinista de QA; no procede de un proveedor LLM.'],
        isReadyForHumanReview: false,
        model: 'qa-stub/mvp-int01',
        promptVersion: 'steps/reasoning/v0.1',
        promptHash: 'sha256:mvp-int01-deterministic-stub',
        tokensUsed: 0,
        costUsd: 0,
        latencyMs: 1,
      }));
    });
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ detail: 'QA stub route not found' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MVP_INT01_AI_STUB_READY http://127.0.0.1:${port}`);
});
