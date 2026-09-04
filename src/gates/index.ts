/** Importing this module registers every built-in gate. */
import './commit.js';
import './review.js';
import './ledger.js';
import './counterweight.js';
import './challenge.js';
import './publish.js';
import './close.js';

export { checkCommandGreen, defectReproBeforeFix, piiAuditClean, selfCritiqueRecorded } from './commit.js';
export { impactRecorded, reachAuditRecorded } from './review.js';
export { ledgerReverified } from './ledger.js';
export { counterweightConsulted } from './counterweight.js';
export { challengePassed, reviewVerdictShip } from './challenge.js';
export { claimsAudited, criteriaValidated } from './publish.js';
export { prRecorded } from './close.js';
