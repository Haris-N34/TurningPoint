# Candidate controls and AI explanation (#19)

The candidate results retain the shared CapabilityCard component and its quote verification. Controls use the existing share, revoke, hidden-clip, witness and deletion functions. Transcripts remain immutable.

- Results explain anonymity and ownership, and missing cards link to a new challenge.
- Witness form has visible labels, two-slot limit, relationship, email validation through the existing contract, a page-local optional name and a copyable link. The name is explicitly not stored or shared; the backend stores only the relationship and a hash of email. No witness email is rendered back on the results card.
- Share, withdrawal, clip visibility and witness-link actions announce their outcome. The existing explicit confirmation remains before deleting candidate data.
- Witness skill chips have 44 px targets and visible keyboard focus; at most three skills can be selected. Confirm and decline remain one-tap actions without an account.
- `/how-we-use-ai` explains deterministic local processing, exact quote checks, formats/accommodations, human decisions, local storage, browser speech-service limitations and candidate controls. The shared header links it from every route, keeping the recruiter card within one laptop screen.

Real phone testing and first-time witness usability timing belong to #21. Browser emulation does not establish either. The local witness link requires the browser data used to create it; no cross-device sync or email delivery is claimed.
