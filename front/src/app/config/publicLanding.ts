const DEFAULT_DEMO_BOOKING_URL =
  'https://calendly.com/fabio-merino-97/new-meeting';

export const PUBLIC_LANDING_CONFIG = {
  demoBookingUrl:
    import.meta.env.VITE_DEMO_BOOKING_URL?.trim() ||
    DEFAULT_DEMO_BOOKING_URL,
};
