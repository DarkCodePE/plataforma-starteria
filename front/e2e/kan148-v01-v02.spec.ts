import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sessionId = '11111111-1111-4111-8111-111111111111';
const evidence = path.resolve(process.cwd(), '../artifacts/KAN-148-V01-V02');
const semanticEvidence = path.resolve(process.cwd(), '../artifacts/KAN-148-R-V01V02-01');
const viewports = [
  { width: 1440, height: 900, root: 16 },
  { width: 390, height: 844, root: 16 },
  { width: 360, height: 800, root: 16 },
  { width: 360, height: 800, root: 32 },
];

const cases = {
  portfolio: {
    entry: 'Tenemos 27 iniciativas en cinco gerencias y necesitamos decidir cuáles financiar o pausar antes del comité. Los reportes no son comparables.',
    answer: 'El comité quiere priorizar retención y reducción de coste; todavía no hay criterios compartidos ni métricas comparables.',
    goal: 'Vamos a aclarar qué información necesitas para decidir cuáles iniciativas financiar o pausar. Primero necesitamos saber cómo podríais comparar sus aportes con la información disponible',
    q1: '¿Qué criterios quiere usar el comité para decidir qué financiar y qué pausar?',
    why1: 'Saberlo puede cambiar si el primer paso es acordar criterios o usar los datos que ya tenéis para comparar',
    question: '¿Qué información tenéis hoy para comparar los aportes de las iniciativas?',
    reason: 'Esto ayuda a decidir qué puede compararse ahora y qué necesita criterios o evidencia adicional antes del comité',
    reading: 'El comité busca priorizar retención y reducción de coste. Todavía no hay criterios compartidos ni métricas comparables para toda la cartera',
  },
  ai: {
    entry: 'Queremos poner un asistente de IA en atención dentro de 90 días; ya elegimos proveedor, pero no sabemos cuál es el cuello de botella.',
    answer: 'Buscamos reducir tiempos de atención y mejorar satisfacción; aún no hay línea base ni hipótesis contrastada sobre las solicitudes que resolvería la IA.',
    goal: 'Vamos a entender qué problema de atención quieres resolver y qué necesitaríamos comprobar antes de decidir si el asistente de IA es la opción adecuada',
    q1: '¿Qué problema de atención necesitáis resolver y cómo sabríais que ha mejorado?',
    why1: 'Esto conecta la solución que ya elegiste con el cambio de atención que esperas conseguir',
    question: '¿Qué evidencia permitiría decidir si desplegar IA o probar primero otra vía?',
    reason: 'Esa evidencia puede cambiar si conviene desplegar ahora o contrastar antes otra opción',
    reading: 'Buscáis reducir tiempos de atención y mejorar satisfacción. Aún no hay línea base ni hipótesis contrastada sobre qué solicitudes resolvería la IA',
  },
  claims: {
    entry: 'Los reclamos complejos tardan unos 18 días y pasan por Operaciones, Legal y Atención. No sabemos si pesan más documentos, aprobaciones o esperas; queremos decidir dónde empezar.',
    answer: 'Todavía no hemos medido en qué tramo se acumulan más esperas ni identificado una causa principal.',
    goal: 'Vamos a aclarar dónde empezar a reducir la demora de los reclamos complejos. Todavía no sabemos si pesan más la documentación, las aprobaciones o las esperas de respuesta',
    q1: '¿Sabéis en qué parte del proceso se acumulan más esperas, o todavía no lo habéis medido?',
    why1: 'Esto nos ayuda a saber si podemos identificar un tramo prioritario o si primero necesitamos observar dónde se producen las demoras',
    question: '¿Qué datos tenéis hoy para distinguir dónde se acumulan las esperas?',
    reason: 'Esto puede cambiar qué tramo conviene observar primero antes de proponer una mejora',
    reading: 'Todavía no se ha identificado con evidencia el tramo que concentra las esperas ni la causa principal de las demoras',
  },
} as const;

type Case = typeof cases[keyof typeof cases];

function session(fixture: Case, state: 'supported_reading' | 'no_supported_insight' | 'insufficient_basis' | 'synthesis_unavailable' = 'supported_reading') {
  return {
    id: sessionId, handoffExperience: 'none', lifecycleStatus: 'CLARIFYING', executionStatus: 'ACTIVE', revision: 2,
    expiresAt: new Date(Date.now() + 60_000).toISOString(), ownership: { state: 'ANONYMOUS' },
    conversation: [
      { id: 'turn-0', turnIndex: 0, userInput: fixture.entry, emittedQuestions: [{
        id: 'q1', question: fixture.q1, reason_to_ask: fixture.why1, resolves: ['decision'],
        turn_index: 0, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 2,
      }], matchedQuestionIds: [], respondedResolves: [], createdAt: new Date().toISOString() },
      { id: 'turn-1', turnIndex: 1, userInput: fixture.answer, emittedQuestions: [{
        id: 'q2', question: fixture.question, reason_to_ask: fixture.reason, resolves: ['evidence'],
        turn_index: 1, interaction_mode: 'quick_clarification', asked_at_budget_remaining: 1,
      }], matchedQuestionIds: ['q1'], respondedResolves: [], createdAt: new Date().toISOString() },
    ],
    clarification: { interactionMode: 'quick_clarification', quickQuestionBudget: 3, quickQuestionsAsked: 2,
      explorationRound: 0, questionsAskedCurrentRound: 0, previousQuestions: [], answeredGaps: [] },
    semanticProjection: {}, nextAction: 'answer_clarification',
    liveUnderstanding: state === 'supported_reading'
      ? { state, reading: fixture.reading, decision: { decisionToPrepare: fixture.goal }, decisionChangingUnknowns: [] }
      : { state, decision: { decisionToPrepare: 'Esta decisión no está sustentada y no debe mostrarse.' },
        decisionChangingUnknowns: state === 'no_supported_insight'
          ? [{ uncertainty: 'Aún falta confirmar el criterio.', whyItMatters: 'Puede cambiar la decisión.' }] : [] },
  };
}

async function routeSyntheticSession(page: Page, response: ReturnType<typeof session>) {
  await page.route('**/api/v1/**', async route => {
    const request=route.request(); const pathname=new URL(request.url()).pathname;
    if (pathname === '/api/v1/public/portfolio-entry/sessions' && request.method()==='POST') {
      await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({success:true,data:{
        session:{...response,revision:0,conversation:[],nextAction:'submit_message',liveUnderstanding:undefined},publicAccessToken:'synthetic-entry-token',
      }})}); return;
    }
    if (pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}/messages`) && request.method()==='POST') {
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:response})}); return;
    }
    if (pathname.endsWith(`/public/portfolio-entry/sessions/${sessionId}`) && request.method()==='GET') {
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:response})}); return;
    }
    if (pathname.endsWith('/auth/refresh') || pathname.endsWith('/auth/me')) {
      await route.fulfill({status:401,contentType:'application/json',body:'{"success":false}'}); return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"data":{}}'});
  });
}

async function start(page: Page, response: ReturnType<typeof session>, root: number) {
  await routeSyntheticSession(page,response);
  await page.goto('/public/start');
  if(root===32) await page.evaluate(()=>{document.documentElement.style.fontSize='32px'});
  await page.getByLabel('¿Qué necesitas resolver, conseguir o entender?').fill(response.conversation[0]!.userInput);
  await page.getByRole('button',{name:/analizar mi situación/i}).click();
  await expect(page.getByTestId('portfolio-entry-conversation-panel')).toBeVisible();
}

async function snapshot(page:Page, tag:string, destination=evidence) {
  await mkdir(path.join(destination,'captures'),{recursive:true});
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(destination,'captures',`${tag}.png`)});
  await page.screenshot({path:path.join(destination,'captures',`${tag}-full.png`),fullPage:true});
}

async function inspect(page: Page) {
  return page.evaluate(()=>{
    const box=(selector:string)=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,right:r.right}};
    return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,
      header:box('header'),promise:box('[data-testid="portfolio-entry-pre-entry-promise"]'),goal:box('[data-testid="portfolio-entry-contextual-goal"]'),
      question:box('[data-testid="portfolio-entry-active-question"]'),answer:box('#portfolio-entry-answer'),
      submit:box('[data-testid="portfolio-entry-conversation-panel"] button'),unknown:box('[data-testid="portfolio-entry-unknown-answer-action"]'),
      reading:box('[data-testid="portfolio-entry-live-understanding"]'),correction:box('[data-testid="portfolio-entry-live-understanding"] button'),
      readingCount:document.querySelectorAll('[data-testid="portfolio-entry-live-understanding"]').length,
      order:[...document.querySelectorAll('[data-testid="portfolio-entry-active-question"],#portfolio-entry-answer,[data-testid="portfolio-entry-unknown-answer-action"],[data-testid="portfolio-entry-live-understanding"]')].map(x=>x.getAttribute('data-testid')||x.id),
    };
  });
}

for (const viewport of viewports) {
  const suffix=`${viewport.width}x${viewport.height}${viewport.root===32?'-200pct':''}`;
  test(`V-01 promesa inicial y reflow ${suffix}`, async ({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.route('**/api/v1/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{"success":false}'}));
    await page.goto('/public/start');
    if(viewport.root===32) await page.evaluate(()=>{document.documentElement.style.fontSize='32px'});
    await expect(page.getByTestId('portfolio-entry-pre-entry-promise')).toContainText('Encuentra por dónde empezar con lo que necesitas resolver');
    await expect(page.getByTestId('portfolio-entry-pre-entry-promise')).toContainText('Si tenemos suficiente claridad y lo solicitas');
    await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
    await expect(page.getByLabel('¿Qué necesitas resolver, conseguir o entender?')).toBeVisible();
    await snapshot(page,`V01-before-${suffix}`);
    const dom=await inspect(page);
    expect(dom.documentWidth).toBeLessThanOrEqual(viewport.width);
    await mkdir(path.join(evidence,'dom'),{recursive:true});
    await writeFile(path.join(evidence,'dom',`V01-before-${suffix}.json`),JSON.stringify(dom,null,2));
  });
}

for(const [key,fixture] of Object.entries(cases) as Array<[keyof typeof cases,Case]>) for(const viewport of viewports) {
  const suffix=`${viewport.width}x${viewport.height}${viewport.root===32?'-200pct':''}`;
  test(`V-02 ${key} ${suffix}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await start(page,session(fixture),viewport.root);
    await expect(page.getByTestId('portfolio-entry-pre-entry-promise')).toHaveCount(0);
    await expect(page.getByTestId('portfolio-entry-contextual-goal')).toHaveAttribute('data-source','supported_reading.decision');
    await expect(page.getByTestId('portfolio-entry-contextual-goal')).toContainText(fixture.goal);
    await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(fixture.question);
    await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(fixture.reason);
    await expect(page.getByTestId('portfolio-entry-live-understanding-content')).toContainText(fixture.reading);
    await expect(page.getByRole('button',{name:/esto no refleja lo que quise decir/i})).toBeVisible();
    const dom=await inspect(page);
    expect(dom.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(dom.readingCount).toBe(1);
    expect(dom.order).toEqual(['portfolio-entry-active-question','portfolio-entry-answer','portfolio-entry-unknown-answer-action','portfolio-entry-live-understanding']);
    expect(dom.goal && dom.question && dom.goal.bottom<dom.question.top).toBeTruthy();
    expect(dom.question && dom.answer && dom.question.bottom<dom.answer.top).toBeTruthy();
    expect(dom.answer && dom.unknown && dom.answer.bottom<dom.unknown.bottom).toBeTruthy();
    expect(dom.unknown && dom.reading && dom.unknown.bottom<dom.reading.top).toBeTruthy();
    expect(dom.submit && dom.submit.height>=44).toBeTruthy();
    expect(dom.unknown && dom.unknown.height>=44).toBeTruthy();
    await snapshot(page,`V02-${key}-${suffix}`);
    await mkdir(path.join(evidence,'dom'),{recursive:true});
    await writeFile(path.join(evidence,'dom',`V02-${key}-${suffix}.json`),JSON.stringify(dom,null,2));
    if(key==='portfolio' && viewport.width===390) {
      await page.reload();
      await expect(page.getByTestId('portfolio-entry-pre-entry-promise')).toHaveCount(0);
      await expect(page.getByTestId('portfolio-entry-contextual-goal')).toContainText(fixture.goal);
    }
  });
}

for (const viewport of viewports.filter(({width})=>width!==1440)) {
  const suffix=`${viewport.width}x${viewport.height}${viewport.root===32?'-200pct':''}`;
  for (const state of ['no_supported_insight','synthesis_unavailable'] as const) {
    test(`R-V01V02-01 ${state} con necesidad explícita ${suffix}`,async({page})=>{
      await page.setViewportSize({width:viewport.width,height:viewport.height});
      await start(page,session(cases.portfolio,state),viewport.root);
      await expect(page.getByTestId('portfolio-entry-contextual-goal')).toHaveCount(0);
      await expect(page.getByText(/Todavía no tengo claro qué necesitas resolver/i)).toHaveCount(0);
      await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(cases.portfolio.question);
      await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(cases.portfolio.reason);
      await expect(page.getByText('Esta decisión no está sustentada y no debe mostrarse.')).toHaveCount(0);
      if(state==='no_supported_insight') {
        await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText('Aún falta confirmar el criterio. Puede cambiar la decisión.');
      } else {
        await expect(page.getByTestId('portfolio-entry-live-understanding')).toContainText('La lectura no está disponible ahora. Puedes continuar con la aclaración.');
      }
      await expect(page.getByRole('button',{name:/esto no refleja lo que quise decir/i})).toHaveCount(0);
      const dom=await inspect(page);
      expect(dom.goal).toBeNull();
      expect(dom.documentWidth).toBeLessThanOrEqual(viewport.width);
      expect(dom.order).toEqual(['portfolio-entry-active-question','portfolio-entry-answer','portfolio-entry-unknown-answer-action','portfolio-entry-live-understanding']);
      expect(dom.submit && dom.submit.height>=44).toBeTruthy();
      expect(dom.unknown && dom.unknown.height>=44).toBeTruthy();
      await snapshot(page,`${state}-${suffix}`,semanticEvidence);
      await mkdir(path.join(semanticEvidence,'dom'),{recursive:true});
      await writeFile(path.join(semanticEvidence,'dom',`${state}-${suffix}.json`),JSON.stringify(dom,null,2));
    });
  }
  test(`R-V01V02-01 corrección activa con necesidad explícita ${suffix}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await start(page,session(cases.portfolio),viewport.root);
    await expect(page.getByTestId('portfolio-entry-contextual-goal')).toContainText(cases.portfolio.goal);
    await page.getByRole('button',{name:/esto no refleja lo que quise decir/i}).click();
    await expect(page.getByTestId('portfolio-entry-contextual-goal')).toHaveCount(0);
    await expect(page.getByText(/Todavía no tengo claro qué necesitas resolver/i)).toHaveCount(0);
    await expect(page.getByTestId('portfolio-entry-active-question-text')).toHaveText(cases.portfolio.question);
    await expect(page.getByTestId('portfolio-entry-active-question-reason')).toHaveText(cases.portfolio.reason);
    await expect(page.getByRole('form',{name:'Corregir la lectura de Starteria'})).toBeVisible();
    await expect(page.getByTestId('portfolio-entry-live-understanding-correction-reference')).toBeVisible();
    const dom=await inspect(page);
    expect(dom.goal).toBeNull();
    expect(dom.readingCount).toBe(1);
    expect(dom.documentWidth).toBeLessThanOrEqual(viewport.width);
    expect(dom.order).toEqual(['portfolio-entry-active-question','portfolio-entry-answer','portfolio-entry-unknown-answer-action','portfolio-entry-live-understanding']);
    await snapshot(page,`correcting-${suffix}`,semanticEvidence);
    await mkdir(path.join(semanticEvidence,'dom'),{recursive:true});
    await writeFile(path.join(semanticEvidence,'dom',`correcting-${suffix}.json`),JSON.stringify(dom,null,2));
  });
}

test('V-02 lectura extensa conserva todo el fixture E2E al 200 % después de las acciones',async({page})=>{
  const sentence='La iniciativa necesita validar una relación entre los permisos de datos, el calendario del comité y la disponibilidad del equipo sin dar por resuelto ninguno de esos puntos. ';
  const response={
    ...session(cases.portfolio),
    conversation:[{
      ...session(cases.portfolio).conversation[0]!,
      userInput:'Necesito entender qué validar en una iniciativa antes del comité.',
      emittedQuestions:[{
        id:'question-1',question:'¿Qué necesita poder validar esta iniciativa?',
        reason_to_ask:'Puede cambiar qué condición habilita el siguiente paso.',
        resolves:['outcome'],turn_index:0,interaction_mode:'quick_clarification',asked_at_budget_remaining:2,
      }],
    }],
    clarification:{...session(cases.portfolio).clarification,quickQuestionsAsked:1},
    liveUnderstanding:{
      state:'supported_reading',reading:sentence.repeat(3),
      tensions:[{statement:'El plazo del comité y el permiso para acceder a datos reales condicionan la validación.',whyItMatters:'Una prueba sin datos autorizados puede no responder la pregunta que el comité necesita resolver.'}],
      decision:{decisionToPrepare:'Si la iniciativa puede validar el prototipo a tiempo para el comité.'},
      decisionChangingUnknowns:[
        {uncertainty:'Aún falta confirmar cuándo estará disponible el permiso.',whyItMatters:'Ese plazo puede cambiar qué evidencia llega al comité.'},
        {uncertainty:'No está claro qué señal considerará suficiente el equipo.',whyItMatters:'La lectura puede cambiar al acordar qué resultado sería útil.'},
      ],
    },
  } as ReturnType<typeof session>;
  await page.setViewportSize({width:360,height:800});
  await start(page,response,32);
  const reading=page.getByTestId('portfolio-entry-live-understanding-content');
  await expect(reading).toHaveCount(1);
  expect((await reading.locator('p').first().textContent())?.trim()).toBe(sentence.repeat(3).trim());
  await expect(reading).toContainText('Aún falta confirmar cuándo estará disponible el permiso.');
  await expect(reading).toContainText('No está claro qué señal considerará suficiente el equipo.');
  const dom=await inspect(page);
  expect(dom.documentWidth).toBeLessThanOrEqual(360);
  expect(dom.unknown && dom.reading && dom.unknown.bottom<dom.reading.top).toBeTruthy();
  const clipping=await reading.evaluate(node=>{const style=getComputedStyle(node);return {maxHeight:style.maxHeight,lineClamp:style.webkitLineClamp,overflow:style.overflow}});
  expect(clipping.maxHeight).toBe('none');
  expect(clipping.lineClamp).toBe('none');
  await snapshot(page,'V02-long-360x800-200pct');
  await mkdir(path.join(evidence,'dom'),{recursive:true});
  await writeFile(path.join(evidence,'dom','V02-long-360x800-200pct.json'),JSON.stringify({...dom,clipping},null,2));
  const correction=page.getByRole('button',{name:/esto no refleja lo que quise decir/i});
  await correction.scrollIntoViewIfNeeded();
  await expect(correction).toBeVisible();
  expect((await correction.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
