import { createHandler } from '../lib/lead-handler.mjs';

// Fixed on the server, never selected by a visitor's request body.
export default createHandler('homework');
export const config = {
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 10 }
};
