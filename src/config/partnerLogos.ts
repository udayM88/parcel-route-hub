// Partner logo mapping for courier selection
// Uses publicly available courier company logos

import shadowfaxLogoAsset from "@/assets/shadowfax.png.asset.json";
const shadowfaxLogo = shadowfaxLogoAsset.url;
import delhiveryLogoAsset from "@/assets/delhivery.png.asset.json";
const delhiveryLogo = delhiveryLogoAsset.url;
import urbaneboltLogoAsset from "@/assets/urbanebolt.png.asset.json";
const urbaneboltLogo = urbaneboltLogoAsset.url;
import shreeMarutiLogoAsset from "@/assets/shree-maruti.png.asset.json";
const shreeMarutiLogo = shreeMarutiLogoAsset.url;
import xpressbeesLogoAsset from "@/assets/xpressbees.png.asset.json";
const xpressbeesLogo = xpressbeesLogoAsset.url;

export const PARTNER_LOGOS: Record<string, string> = {
  // Prayog sandbox partners
  'dharmendra': 'https://ui-avatars.com/api/?name=Dharmendra&background=6366f1&color=fff&size=100',
  'india_post_domestic': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/91/India_Post_Logo.svg/200px-India_Post_Logo.svg.png',
  'sunil_baral': 'https://ui-avatars.com/api/?name=Sunil+Baral&background=10b981&color=fff&size=100',
  
  // Common courier partners
  'bluedart': 'https://logo.clearbit.com/bluedart.com',
  'delhivery': delhiveryLogo,
  'delhivery_direct': delhiveryLogo,
  'dlv': delhiveryLogo,
  'dtdc': 'https://logo.clearbit.com/dtdc.in',
  'ecom_express': 'https://logo.clearbit.com/ecomexpress.in',
  'xpressbees': xpressbeesLogo,
  'xpressbees_direct': xpressbeesLogo,
  'shadowfax': shadowfaxLogo,
  'shadowfax_direct': shadowfaxLogo,
  'urbanebolt': urbaneboltLogo,
  'urbanebolt_direct': urbaneboltLogo,
  'shree_maruti': shreeMarutiLogo,
  'shree_maruti_direct': shreeMarutiLogo,
  'ekart': 'https://logo.clearbit.com/ekartlogistics.com',
  'amazon_shipping': 'https://logo.clearbit.com/amazon.in',
  'fedex': 'https://logo.clearbit.com/fedex.com',
  'india_post': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/91/India_Post_Logo.svg/200px-India_Post_Logo.svg.png',
  'professional_couriers': 'https://logo.clearbit.com/tpcindia.com',
  'gati': 'https://logo.clearbit.com/gati.com',
  'firstflight': 'https://logo.clearbit.com/firstflight.net',
  'spoton': 'https://logo.clearbit.com/spoton.co.in',
  'trackon': 'https://logo.clearbit.com/trackoncourier.com',
  'safexpress': 'https://logo.clearbit.com/safexpress.com',
  'rivigo': 'https://logo.clearbit.com/rivigo.com',
  'movin': 'https://logo.clearbit.com/movin.in',
  'wow_express': 'https://logo.clearbit.com/wowexpress.in',
  'shiprocket': 'https://logo.clearbit.com/shiprocket.in',
};

// Generate a fallback logo URL using UI Avatars for unknown partners
const generateFallbackLogo = (name: string): string => {
  const encodedName = encodeURIComponent(name.replace(/_/g, ' '));
  return `https://ui-avatars.com/api/?name=${encodedName}&background=8b5cf6&color=fff&size=100&bold=true`;
};

export const getPartnerLogo = (partnerCode: string, partnerName?: string): string => {
  if (!partnerCode) return generateFallbackLogo('?');
  
  // Normalize the partner code to match our mapping keys
  const normalizedCode = partnerCode.toLowerCase().replace(/[- ]/g, '_');
  
  // Return mapped logo or generate a fallback
  return PARTNER_LOGOS[normalizedCode] || generateFallbackLogo(partnerName || partnerCode);
};
