// Pipedrive's organization Industry is a picklist of 20 values (`context/pipedrive/organization-industry-list.md`,
// copied by QA from the Pipedrive form on 2026-10-26). Create Organization sends the prospect's Company Industry,
// and Pipedrive answers 400 "industry with provided value does not exist" for any other text.
export const PIPEDRIVE_INDUSTRIES = [
  'Accommodation services', 'Administrative and support services', 'Construction', 'Consumer services', 'Education',
  'Entertainment providers', 'Farming, ranching, forestry', 'Financial services', 'Government administration',
  'Holding companies', 'Hospitals and health care', 'Manufacturing', 'Oil, gas, and mining', 'Professional services',
  'Real estate and equipment rental services', 'Retail', 'Technology, information and media',
  'Transportation, logistics, supply chain and storage', 'Utilities', 'Wholesale',
];

// QA's mapping from the Outcome Updated spec: Ecommerce to Retail, every other value to one list value.
export function pipedriveIndustry(value: string): string {
  if (!value || PIPEDRIVE_INDUSTRIES.includes(value)) return value;
  return value === 'Ecommerce' ? 'Retail' : 'Technology, information and media';
}
