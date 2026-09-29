export const PORTFOLIO_SETUP_EVENTS = [
  'portfolio_setup_started',
  'portfolio_goal_submitted',
  'portfolio_existing_work_submitted',
  'portfolio_first_value_rendered',
  'portfolio_rationale_opened',
  'portfolio_interpretation_corrected',
  'portfolio_relationship_review_clicked',
] as const;

export type PortfolioSetupEventName = (typeof PORTFOLIO_SETUP_EVENTS)[number];
export interface PortfolioSetupEvent {
  name: PortfolioSetupEventName;
  at: number;
}

type EventListener = (event: PortfolioSetupEvent) => void;
const listeners = new Set<EventListener>();
const events: PortfolioSetupEvent[] = [];

declare global {
  interface Window {
    __starteriaPrototypeEvents?: PortfolioSetupEvent[];
  }
}

export function trackPortfolioSetupEvent(name: PortfolioSetupEventName): void {
  const event = { name, at: Date.now() };
  events.push(event);
  if (typeof window !== 'undefined') window.__starteriaPrototypeEvents = [...events];
  listeners.forEach(listener => listener(event));
}

export function subscribeToPortfolioSetupEvents(listener: EventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPortfolioSetupEvents(): PortfolioSetupEvent[] {
  return [...events];
}

export function resetPortfolioSetupEvents(): void {
  events.splice(0, events.length);
}
