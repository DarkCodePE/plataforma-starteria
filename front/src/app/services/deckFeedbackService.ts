import api from './api';

export interface DeckFeedbackResult {
  summary: string;
  goodPoints: string[];
  missing: string[];
  unsupportedClaims: Array<{ claim: string; why: string }>;
  inconsistencies: string[];
  nextAction: string;
  pages: number;
  extractedChars: number;
  deckTruncated: boolean;
}

export interface DeckFeedback {
  id: string;
  pdfId: string;
  fileName: string;
  result: DeckFeedbackResult;
  createdAt: string;
}

interface Envelope<T> { success: boolean; data: T }

export async function listDeckFeedback(projectId: string): Promise<DeckFeedback[]> {
  const { data } = await api.get<Envelope<DeckFeedback[]>>(`/projects/${projectId}/deck-feedback`);
  return data.data;
}

// Feedback IA del Step 4: sube el PDF (bytes crudos, como los PDFs de iniciativa) y la IA lo lee
// contra los Steps confirmados. Consume un crédito de mentor sólo si el análisis sale.
export async function analyzeDeck(projectId: string, file: File): Promise<DeckFeedback> {
  const bytes = await file.arrayBuffer();
  const { data } = await api.post<Envelope<DeckFeedback>>(`/projects/${projectId}/deck-feedback`, bytes, {
    headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
    timeout: 150_000,
  });
  return data.data;
}
