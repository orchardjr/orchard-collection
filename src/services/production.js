export const ORCHARD_DOMAINS = Object.freeze({
  marketing: "https://orchardcollection.ca",
  app: "https://app.orchardcollection.ca"
});

export function plantPublicURL(accession) {
  return `${ORCHARD_DOMAINS.app}/?plant=${encodeURIComponent(accession)}`;
}
