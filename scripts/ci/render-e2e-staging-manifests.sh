#!/usr/bin/env bash
# Render the production-shaped manifests into the isolated P12 namespace.
# This script never talks to Kubernetes; the caller reviews/applies the output.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
namespace="${NAMESPACE:-starteria-e2e}"
output_dir="${1:-}"

[[ "$namespace" == "starteria-e2e" && "$namespace" != "starteria" ]] || {
  echo "::error::refusing production namespace: ${namespace:-<empty>}" >&2
  exit 1
}
[[ -n "$output_dir" ]] || { echo "usage: $0 <new-output-directory>" >&2; exit 2; }
[[ ! -e "$output_dir" ]] || { echo "::error::output directory already exists: $output_dir" >&2; exit 1; }

for name in E2E_STAGING_BASE_URL BACKEND_IMAGE FRONTEND_IMAGE AI_SERVICE_IMAGE; do
  [[ -n "${!name:-}" ]] || { echo "::error::$name is required" >&2; exit 1; }
done

node - "$repo_root" "$output_dir" "$namespace" \
  "$E2E_STAGING_BASE_URL" "$BACKEND_IMAGE" "$FRONTEND_IMAGE" "$AI_SERVICE_IMAGE" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const [repo, out, namespace, baseUrl, backendImage, frontendImage, aiImage] = process.argv.slice(2);
const fail = (message) => { throw new Error(message); };

let parsed;
try { parsed = new URL(baseUrl); } catch { fail('E2E_STAGING_BASE_URL must be a valid URL'); }
const host = parsed.hostname.toLowerCase();
const privateHost = host === 'localhost' || host === '127.0.0.1' || host === 'starter-ia.com'
  || host.endsWith('.starter-ia.com') || /^10\./.test(host) || /^192\.168\./.test(host)
  || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
if (parsed.protocol !== 'https:' || parsed.username || parsed.password || privateHost) {
  fail('E2E_STAGING_BASE_URL must be a separate public HTTPS hostname');
}

const imageRules = [
  [backendImage, /^[-a-z0-9./]+\/starteria-backend:e2e-[0-9a-f]{12}$/],
  [frontendImage, /^[-a-z0-9./]+\/starteria-frontend:e2e-[0-9a-f]{12}$/],
  [aiImage, /^[-a-z0-9./]+\/starteria-ai-service:e2e-[0-9a-f]{12}$/],
];
for (const [image, rule] of imageRules) if (!rule.test(image)) fail(`unsafe immutable image: ${image}`);

fs.mkdirSync(out, { recursive: false });

const sources = {
  'postgres-service.yaml': 'k8s/postgres-service.yaml',
  'postgres-statefulset.yaml': 'k8s/postgres-statefulset.yaml',
  'backend-storage-pvc.yaml': 'k8s/backend-storage-pvc.yaml',
  'backend-deployment.yaml': 'k8s/backend-deployment.yaml',
  'backend-service.yaml': 'k8s/backend-service.yaml',
  'frontend-deployment.yaml': 'k8s/frontend-deployment.yaml',
  'frontend-service.yaml': 'k8s/frontend-service.yaml',
  'ai-service-deployment.yaml': 'k8s/ai-service-deployment.yaml',
  'ai-service-service.yaml': 'k8s/ai-service-service.yaml',
  'cloudflared-deployment.yaml': 'k8s/cloudflared-deployment.yaml',
  'cloudflared-service.yaml': 'k8s/cloudflared-service.yaml',
};

function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) fail(`render source changed: missing ${label}`);
  return text.replace(search, replacement);
}

function isolatePod(text) {
  const marker = '    spec:\n';
  if (!text.includes(marker)) fail('workload has no pod spec');
  return text.replace(marker, `${marker}      automountServiceAccountToken: false\n`);
}

for (const [target, source] of Object.entries(sources)) {
  let text = fs.readFileSync(path.join(repo, source), 'utf8').replace(/\r\n/g, '\n');
  text = text.replace(/^  namespace: starteria$/gm, `  namespace: ${namespace}`);

  if (target === 'backend-deployment.yaml') {
    text = replaceRequired(text, 'image: orlandogtp/starteria-backend:v2.0.2', `image: ${backendImage}`, 'backend image');
    text = replaceRequired(text, 'value: "https://starter-ia.com"', `value: "${baseUrl}"`, 'backend CORS origin');
    text = replaceRequired(text, '        - name: SMTP_PORT\n          value: "587"', [
      '        - name: SMTP_HOST',
      '          value: "mailpit"',
      '        - name: SMTP_PORT',
      '          value: "1025"',
      '        - name: SMTP_USER',
      '          value: ""',
      '        - name: SMTP_PASS',
      '          value: ""',
      '        - name: PILOT_LEAD_NOTIFY_FROM',
      '          value: "Starteria E2E <sandbox@starteria.test>"',
      '        - name: PILOT_LEAD_EMAIL_ENABLED',
      '          value: "false"',
      '        - name: HANDOFF_EMAIL_TRANSPORT_MODE',
      '          value: "sandbox"',
      '        - name: HANDOFF_EMAIL_PILOT_ENABLED',
      '          value: "false"',
      '        - name: HANDOFF_INVITATION_PUBLIC_BASE_URL',
      `          value: "${baseUrl}"`,
      '        - name: HANDOFF_EMAIL_REPLY_TO',
      '          value: "support@starteria.test"',
    ].join('\n'), 'sandbox SMTP block');
    text = replaceRequired(text, 'value: "okuanb@gmail.com"', 'value: "e2e-participante@starteria.test"', 'synthetic mail recipient');
    text = isolatePod(text);
  } else if (target === 'frontend-deployment.yaml') {
    text = replaceRequired(text, 'image: orlandogtp/starteria-frontend:v2.0.9', `image: ${frontendImage}`, 'frontend image');
    text = isolatePod(text);
  } else if (target === 'ai-service-deployment.yaml') {
    text = replaceRequired(text, 'image: orlandogtp/starteria-ai-service:latest', `image: ${aiImage}`, 'AI image');
    text = replaceRequired(text, 'value: "production"', 'value: "e2e-staging"', 'AI environment');
    text = replaceRequired(text, 'value: "starteria"', 'value: "starteria-e2e"', 'LangSmith project');
    text = isolatePod(text);
  } else if (target === 'cloudflared-deployment.yaml' || target === 'postgres-statefulset.yaml') {
    text = isolatePod(text);
  }

  fs.writeFileSync(path.join(out, target), text);
}

const mailpit = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: mailpit
  namespace: ${namespace}
  labels:
    app: mailpit
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: mailpit
  template:
    metadata:
      labels:
        app: mailpit
    spec:
      automountServiceAccountToken: false
      containers:
        - name: mailpit
          image: axllent/mailpit:v1.27.10@sha256:b1f1be18af530d939a11ee8820b379e0c88eeec204d904bfad68862adced3a5a
          ports:
            - { name: smtp, containerPort: 1025 }
            - { name: http, containerPort: 8025 }
          env:
            - { name: MP_MAX_MESSAGES, value: "200" }
            - { name: MP_DATABASE, value: /data/mailpit.db }
          readinessProbe:
            httpGet: { path: /livez, port: http }
          livenessProbe:
            httpGet: { path: /livez, port: http }
          resources:
            requests: { cpu: 25m, memory: 64Mi }
            limits: { cpu: 200m, memory: 256Mi }
          volumeMounts:
            - { name: data, mountPath: /data }
      volumes:
        - name: data
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: mailpit
  namespace: ${namespace}
spec:
  selector: { app: mailpit }
  ports:
    - { name: smtp, port: 1025, targetPort: smtp }
    - { name: http, port: 8025, targetPort: http }
`;
fs.writeFileSync(path.join(out, 'mailpit.yaml'), mailpit);

const policies = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny-all, namespace: ${namespace} }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: ${namespace} }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels: { kubernetes.io/metadata.name: kube-system }
      ports:
        - { protocol: UDP, port: 53 }
        - { protocol: TCP, port: 53 }
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: frontend-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: starteria-frontend } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: cloudflared-tunnel } } }]
      ports: [{ protocol: TCP, port: 80 }]
  egress:
    - to: [{ podSelector: { matchLabels: { app: starteria-backend } } }]
      ports: [{ protocol: TCP, port: 3001 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: backend-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: starteria-backend } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: starteria-frontend } } }]
      ports: [{ protocol: TCP, port: 3001 }]
    - from: [{ podSelector: { matchLabels: { app: starteria-ai-service } } }]
      ports: [{ protocol: TCP, port: 3001 }]
  egress:
    - to: [{ podSelector: { matchLabels: { app: starteria-db } } }]
      ports: [{ protocol: TCP, port: 5432 }]
    - to: [{ podSelector: { matchLabels: { app: starteria-ai-service } } }]
      ports: [{ protocol: TCP, port: 8001 }]
    - to: [{ podSelector: { matchLabels: { app: mailpit } } }]
      ports: [{ protocol: TCP, port: 1025 }]
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
      ports: [{ protocol: TCP, port: 443 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: ai-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: starteria-ai-service } }
  policyTypes: [Ingress, Egress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: starteria-backend } } }]
      ports: [{ protocol: TCP, port: 8001 }]
  egress:
    - to: [{ podSelector: { matchLabels: { app: starteria-backend } } }]
      ports: [{ protocol: TCP, port: 3001 }]
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
      ports: [{ protocol: TCP, port: 443 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: postgres-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: starteria-db } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: starteria-backend } } }]
      ports: [{ protocol: TCP, port: 5432 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: mailpit-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: mailpit } }
  policyTypes: [Ingress]
  ingress:
    - from: [{ podSelector: { matchLabels: { app: starteria-backend } } }]
      ports: [{ protocol: TCP, port: 1025 }]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: cloudflared-flow, namespace: ${namespace} }
spec:
  podSelector: { matchLabels: { app: cloudflared-tunnel } }
  policyTypes: [Egress]
  egress:
    - to: [{ podSelector: { matchLabels: { app: starteria-frontend } } }]
      ports: [{ protocol: TCP, port: 80 }]
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16]
      ports:
        - { protocol: TCP, port: 443 }
        - { protocol: TCP, port: 7844 }
        - { protocol: UDP, port: 7844 }
`;
fs.writeFileSync(path.join(out, 'network-policies.yaml'), policies);

const rendered = fs.readdirSync(out).filter((name) => name.endsWith('.yaml'));
if (rendered.length !== 13) fail(`unexpected manifest count: ${rendered.length}`);
for (const name of rendered) {
  const text = fs.readFileSync(path.join(out, name), 'utf8');
  if (/^  namespace: starteria$/m.test(text) || text.includes('https://starter-ia.com')) {
    fail(`production reference remained in ${name}`);
  }
  const namespaces = [...text.matchAll(/namespace:\s*([^\s,}]+)/g)].map((match) => match[1]);
  if (namespaces.some((value) => value !== namespace && value !== 'kube-system')) {
    fail(`unexpected namespace in ${name}: ${namespaces.join(',')}`);
  }
}
NODE

echo "rendered isolated E2E manifests in $output_dir"
