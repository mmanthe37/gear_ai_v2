/**
 * Gear AI CoPilot – Comprehensive OEM Manual Source Database
 *
 * Maps 40+ vehicle manufacturers to their official owner's manual
 * download portals, direct PDF URL patterns, and CDN locations.
 *
 * Each entry includes:
 *   - Direct PDF URL pattern (if manufacturer hosts predictable URLs)
 *   - Owner portal search page (for HTML-based lookup)
 *   - Known CDN/document-server patterns
 *   - Year-range applicability
 *   - Whether VIN-based lookup is supported
 *
 * @module services/oem-manual-sources
 */

import { VehicleLookup } from '../types/manual';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OemManualSource {
  /** Manufacturer key (lowercase) */
  make: string;
  /** Human-readable brand name */
  brand: string;
  /** Parent automotive group (for shared CDN patterns) */
  group?: string;
  /** Whether the portal supports VIN-based lookup */
  supportsVinLookup: boolean;
  /** URL of the owner manual search/download portal */
  portalUrl: string;
  /** Year range this pattern covers [min, max] — 0 means unbounded */
  yearRange: [number, number];
  /**
   * Generate candidate PDF URLs for a given vehicle.
   * Returns multiple candidates in priority order.
   */
  generateCandidateUrls: (vehicle: VehicleLookup) => string[];
  /** Alternative model name mappings (e.g. "RAV4" → "rav4") */
  modelNormalizer?: (model: string) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
}

function underscorify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function last2(year: number): string {
  return year.toString().slice(-2);
}

// ---------------------------------------------------------------------------
// GM Group shared CDN pattern
// ---------------------------------------------------------------------------

function gmCandidates(brand: string, vehicle: VehicleLookup): string[] {
  const m = encodeURIComponent(vehicle.model);
  const slug = slugify(vehicle.model);
  const base = `https://my.${brand.toLowerCase()}.com/content/dam/gmownercenter/gmna/dynamic/manuals`;
  return [
    `${base}/${vehicle.year}/${m}/en_US/eOwnerManual.pdf`,
    `${base}/${vehicle.year}/${slug}/en_US/eOwnerManual.pdf`,
    `https://www.${brand.toLowerCase()}.com/bypass/pcf/gma-content-api/resources/sites/GMA/content/staging/MANUALS/CHANNEL/Desktop/${vehicle.year}/${m}/pdf/en_US/eOwnerManual.pdf`,
  ];
}

// ---------------------------------------------------------------------------
// Stellantis Group shared pattern
// ---------------------------------------------------------------------------

function stellantisCandidates(brand: string, vehicle: VehicleLookup): string[] {
  const m = encodeURIComponent(vehicle.model);
  const slug = slugify(vehicle.model);
  return [
    `https://www.${brand.toLowerCase()}.com/content/dam/fca-brands/${brand.toLowerCase()}/us/owners/${vehicle.year}/${slug}/owners-manual.pdf`,
    `https://www.mopar.com/content/dam/mopar/manuals/${vehicle.year}/${brand.toLowerCase()}-${slug}-owners-manual.pdf`,
    `https://owners.${brand.toLowerCase()}.com/content/dam/owners-app/${brand.toLowerCase()}/manuals/${vehicle.year}_${m}_OM.pdf`,
  ];
}

// ---------------------------------------------------------------------------
// OEM Source Registry
// ---------------------------------------------------------------------------

export const OEM_SOURCES: OemManualSource[] = [
  // ─── Ford Motor Company ─────────────────────────────────────────
  {
    make: 'ford',
    brand: 'Ford',
    group: 'Ford',
    supportsVinLookup: true,
    portalUrl: 'https://www.ford.com/support/owner-manuals-details/',
    yearRange: [1996, 0],
    generateCandidateUrls: (v) => [
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${v.year}-Ford-${encodeURIComponent(v.model)}-Owners-Manual.pdf`,
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${v.year}-Ford-${slugify(v.model)}-Owners-Manual.pdf`,
      `https://owner.ford.com/tools/account/how-tos/owner-manuals.html#/manual/${v.year}/ford/${slugify(v.model)}`,
    ],
  },
  {
    make: 'lincoln',
    brand: 'Lincoln',
    group: 'Ford',
    supportsVinLookup: true,
    portalUrl: 'https://www.lincoln.com/support/owner-manuals-details/',
    yearRange: [1996, 0],
    generateCandidateUrls: (v) => [
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${v.year}-Lincoln-${encodeURIComponent(v.model)}-Owners-Manual.pdf`,
      `https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/${v.year}-Lincoln-${slugify(v.model)}-Owners-Manual.pdf`,
    ],
  },

  // ─── General Motors ─────────────────────────────────────────────
  {
    make: 'chevrolet',
    brand: 'Chevrolet',
    group: 'GM',
    supportsVinLookup: true,
    portalUrl: 'https://experience.gm.com/support/vehicle/manuals-guides',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => gmCandidates('Chevrolet', v),
  },
  {
    make: 'gmc',
    brand: 'GMC',
    group: 'GM',
    supportsVinLookup: true,
    portalUrl: 'https://experience.gm.com/support/vehicle/manuals-guides',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => gmCandidates('GMC', v),
  },
  {
    make: 'buick',
    brand: 'Buick',
    group: 'GM',
    supportsVinLookup: true,
    portalUrl: 'https://experience.gm.com/support/vehicle/manuals-guides',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => gmCandidates('Buick', v),
  },
  {
    make: 'cadillac',
    brand: 'Cadillac',
    group: 'GM',
    supportsVinLookup: true,
    portalUrl: 'https://experience.gm.com/support/vehicle/manuals-guides',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => gmCandidates('Cadillac', v),
  },

  // ─── Toyota / Lexus ────────────────────────────────────────────
  {
    make: 'toyota',
    brand: 'Toyota',
    group: 'Toyota',
    supportsVinLookup: false,
    portalUrl: 'https://www.toyota.com/owners/resources/owners-manuals',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => {
      const m = slugify(v.model);
      return [
        `https://www.toyota.com/t3Portal/document/om-s/${last2(v.year)}/pdf/en/${m}.pdf`,
        `https://www.toyota.com/t3Portal/document/om-s/${v.year}/pdf/en/OM${m}.pdf`,
        `https://www.toyota.com/owners/resources/warranty-owners-manuals/${m}/${v.year}`,
      ];
    },
  },
  {
    make: 'lexus',
    brand: 'Lexus',
    group: 'Toyota',
    supportsVinLookup: false,
    portalUrl: 'https://drivers.lexus.com/lexusdrivers/resources/owners-manuals',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => {
      const m = slugify(v.model);
      return [
        `https://drivers.lexus.com/lexusdrivers/resources/owners-manuals/${m}/${v.year}`,
        `https://www.lexus.com/content/dam/lexus/documents/owners-manual/${v.year}-${m}-owners-manual.pdf`,
      ];
    },
  },

  // ─── Honda / Acura ─────────────────────────────────────────────
  {
    make: 'honda',
    brand: 'Honda',
    group: 'Honda',
    supportsVinLookup: true,
    portalUrl: 'https://mygarage.honda.com/s/manuals-search',
    yearRange: [1998, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://techinfo.honda.com/rNavigator/document.aspx?DocumentID=${v.year}_${m}_OM`,
        `https://owners.honda.com/documentconnection/PdfViewer?ModelYear=${v.year}&Model=${m}&PubType=OM`,
        `https://owners.honda.com/Documentconnection/GetPdf?year=${v.year}&model=${m}`,
      ];
    },
  },
  {
    make: 'acura',
    brand: 'Acura',
    group: 'Honda',
    supportsVinLookup: true,
    portalUrl: 'https://mygarage.honda.com/s/manuals-search',
    yearRange: [1998, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://techinfo.honda.com/rNavigator/document.aspx?DocumentID=${v.year}_Acura_${m}_OM`,
        `https://owners.acura.com/documentconnection/PdfViewer?ModelYear=${v.year}&Model=${m}&PubType=OM`,
      ];
    },
  },

  // ─── Hyundai / Kia / Genesis (Hyundai Motor Group) ─────────────
  {
    make: 'hyundai',
    brand: 'Hyundai',
    group: 'HMG',
    supportsVinLookup: false,
    portalUrl: 'https://owners.hyundaiusa.com/us/en/resources/manuals-warranties.html',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const m = underscorify(v.model);
      const slug = slugify(v.model);
      return [
        `https://owners.hyundaiusa.com/content/dam/hyundaiusa/owners_content/${v.year}/${m}/owners_manual.pdf`,
        `https://owners.hyundaiusa.com/content/dam/hyundaiusa/owners_content/${v.year}/${slug}/${v.year}-${slug}-owners-manual.pdf`,
        `https://www.hyundaiusa.com/us/en/resources-tools/owners-manual/${v.year}/${slug}`,
      ];
    },
  },
  {
    make: 'kia',
    brand: 'Kia',
    group: 'HMG',
    supportsVinLookup: false,
    portalUrl: 'https://www.kia.com/us/en/owners/manuals-and-guides',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.kia.com/dam/kia/us/owner/pdf/${v.year}/${slug}/owners-manual.pdf`,
        `https://owners.kia.com/content/dam/kia-owners/pdf/manuals/${v.year}-${slug}-owners-manual.pdf`,
      ];
    },
  },
  {
    make: 'genesis',
    brand: 'Genesis',
    group: 'HMG',
    supportsVinLookup: false,
    portalUrl: 'https://www.genesis.com/us/en/owners/manuals-and-downloads.html',
    yearRange: [2017, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.genesis.com/content/dam/genesis/us/manual/${v.year}/${slug}/owners-manual.pdf`,
        `https://www.genesis.com/us/en/owners/manuals/${v.year}-${slug}`,
      ];
    },
  },

  // ─── Nissan / Infiniti ─────────────────────────────────────────
  {
    make: 'nissan',
    brand: 'Nissan',
    group: 'Nissan',
    supportsVinLookup: false,
    portalUrl: 'https://www.nissanusa.com/owners/manuals-guides.html',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      const slug = slugify(v.model);
      return [
        `https://owners.nissanusa.com/content/techpub/ManualsAndGuides/${v.year}/${m}/Owner_Manual_English.pdf`,
        `https://www.nissanusa.com/content/dam/nissan/us/manuals/${v.year}/${slug}-owners-manual.pdf`,
      ];
    },
  },
  {
    make: 'infiniti',
    brand: 'INFINITI',
    group: 'Nissan',
    supportsVinLookup: false,
    portalUrl: 'https://www.infinitiusa.com/owners/manuals-guides.html',
    yearRange: [2000, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://owners.infinitiusa.com/content/techpub/ManualsAndGuides/${v.year}/${m}/Owner_Manual_English.pdf`,
      ];
    },
  },

  // ─── Stellantis (Chrysler, Dodge, Jeep, Ram, Fiat, Alfa Romeo) ─
  {
    make: 'chrysler',
    brand: 'Chrysler',
    group: 'Stellantis',
    supportsVinLookup: true,
    portalUrl: 'https://www.chrysler.com/owners/manuals.html',
    yearRange: [2004, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Chrysler', v),
  },
  {
    make: 'dodge',
    brand: 'Dodge',
    group: 'Stellantis',
    supportsVinLookup: true,
    portalUrl: 'https://www.dodge.com/owners/manuals.html',
    yearRange: [2004, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Dodge', v),
  },
  {
    make: 'jeep',
    brand: 'Jeep',
    group: 'Stellantis',
    supportsVinLookup: true,
    portalUrl: 'https://www.jeep.com/owners/manuals.html',
    yearRange: [2004, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Jeep', v),
  },
  {
    make: 'ram',
    brand: 'Ram',
    group: 'Stellantis',
    supportsVinLookup: true,
    portalUrl: 'https://www.ramtrucks.com/owners/manuals.html',
    yearRange: [2010, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Ram', v),
  },
  {
    make: 'fiat',
    brand: 'FIAT',
    group: 'Stellantis',
    supportsVinLookup: false,
    portalUrl: 'https://www.fiatusa.com/owners/manuals.html',
    yearRange: [2012, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Fiat', v),
  },
  {
    make: 'alfa romeo',
    brand: 'Alfa Romeo',
    group: 'Stellantis',
    supportsVinLookup: false,
    portalUrl: 'https://www.alfaromeousa.com/owners/manuals.html',
    yearRange: [2017, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Alfa-Romeo', v),
  },

  // ─── Volkswagen Group (VW, Audi, Porsche) ──────────────────────
  {
    make: 'volkswagen',
    brand: 'Volkswagen',
    group: 'VAG',
    supportsVinLookup: true,
    portalUrl: 'https://www.vw.com/en/owners-and-services/about-my-vehicle/owners-manual.html',
    yearRange: [2012, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.vw.com/content/dam/vw/owners/manuals/${v.year}_${titleCase(v.model)}_OM.pdf`,
        `https://ownersmanuals2.com/volkswagen/${slug}-${v.year}-owners-manual`,
      ];
    },
  },
  {
    make: 'audi',
    brand: 'Audi',
    group: 'VAG',
    supportsVinLookup: true,
    portalUrl: 'https://www.audiusa.com/us/web/en/myaudi/owners-manuals.html',
    yearRange: [2008, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://www.audiusa.com/content/dam/nemo/us/Ownership/Owners_Manual/${v.year}_Audi_${m}_OM.pdf`,
        `https://ownermanual2.com/audi/${slugify(v.model)}-${v.year}-owners-manual`,
      ];
    },
  },
  {
    make: 'porsche',
    brand: 'Porsche',
    group: 'VAG',
    supportsVinLookup: true,
    portalUrl: 'https://www.porsche.com/usa/accessoriesandservices/porscheservice/vehicleinformation/',
    yearRange: [2010, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.porsche.com/usa/content/dam/porsche/documents/owner-manuals/${v.year}-${slug}-owners-manual.pdf`,
      ];
    },
  },

  // ─── BMW Group (BMW, MINI) ─────────────────────────────────────
  {
    make: 'bmw',
    brand: 'BMW',
    group: 'BMW',
    supportsVinLookup: true,
    portalUrl: 'https://www.bmwusa.com/explore/bmw-value/bmw-owners-manuals.html',
    yearRange: [2002, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://www.bmwusa.com/content/bmwusa/marketUS/bmwusa_com/en/owners-manual/${v.year}/${m}.pdf`,
        `https://mybmw.bmwusa.com/content/dam/bmwusa/owners/${v.year}/${m}/owners-manual.pdf`,
      ];
    },
  },
  {
    make: 'mini',
    brand: 'MINI',
    group: 'BMW',
    supportsVinLookup: true,
    portalUrl: 'https://www.miniusa.com/owners.html',
    yearRange: [2006, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      return [
        `https://www.miniusa.com/content/dam/mini/us/owners/${v.year}/${m}/owners-manual.pdf`,
      ];
    },
  },

  // ─── Mercedes-Benz ─────────────────────────────────────────────
  {
    make: 'mercedes-benz',
    brand: 'Mercedes-Benz',
    group: 'Mercedes',
    supportsVinLookup: true,
    portalUrl: 'https://www.mbusa.com/en/owners/manuals',
    yearRange: [2004, 0],
    generateCandidateUrls: (v) => {
      const m = encodeURIComponent(v.model);
      const slug = slugify(v.model);
      return [
        `https://www.mbusa.com/content/dam/mb-nafta/us/owners/manuals/${v.year}-${slug}-owners-manual.pdf`,
        `https://ownersmanuals2.com/mercedes/${slug}-${v.year}-owners-manual`,
      ];
    },
    modelNormalizer: (model) => model.replace(/\s*-\s*class/i, '-Class'),
  },

  // ─── Subaru ────────────────────────────────────────────────────
  {
    make: 'subaru',
    brand: 'Subaru',
    group: 'Subaru',
    supportsVinLookup: false,
    portalUrl: 'https://www.subaru.com/owners/index',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://cdn.subaru.io/content/media/pdf/${v.year}/${slug}/owners-manual.pdf`,
        `https://www.subaru.com/content/dam/subaru/us/pdf/manuals/${v.year}-${slug}-owners-manual.pdf`,
        `https://www.subaru.com/owners/manuals/${v.year}-${slug}`,
      ];
    },
  },

  // ─── Mazda ─────────────────────────────────────────────────────
  {
    make: 'mazda',
    brand: 'Mazda',
    group: 'Mazda',
    supportsVinLookup: false,
    portalUrl: 'https://www.mazdausa.com/owners/manuals-and-guides',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      const m = encodeURIComponent(v.model);
      return [
        `https://www.mazdausa.com/static/manuals/${v.year}-mazda-${slug}-owners-manual.pdf`,
        `https://www.mazdausa.com/owners/manuals-and-guides#year=${v.year}&vehicle=${m}`,
      ];
    },
  },

  // ─── Volvo ─────────────────────────────────────────────────────
  {
    make: 'volvo',
    brand: 'Volvo',
    group: 'Volvo',
    supportsVinLookup: true,
    portalUrl: 'https://www.volvocars.com/us/support/manuals/',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://az685612.vo.msecnd.net/static/manuals/pdf/${v.year}_Volvo_${titleCase(v.model)}_Owners_Manual.pdf`,
        `https://www.volvocars.com/us/support/manuals/${v.year}/${slug}/`,
      ];
    },
  },

  // ─── Tesla ─────────────────────────────────────────────────────
  {
    make: 'tesla',
    brand: 'Tesla',
    group: 'Tesla',
    supportsVinLookup: false,
    portalUrl: 'https://www.tesla.com/ownersmanual',
    yearRange: [2012, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.tesla.com/ownersmanual/${slug}`,
        `https://www.tesla.com/sites/default/files/model_${slug.replace('model-', '')}_owners_manual_north_america_en.pdf`,
      ];
    },
  },

  // ─── Rivian ────────────────────────────────────────────────────
  {
    make: 'rivian',
    brand: 'Rivian',
    group: 'Rivian',
    supportsVinLookup: false,
    portalUrl: 'https://rivian.com/support/article/owner-guide',
    yearRange: [2022, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://rivian.com/support/article/${slug}-owner-guide`,
      ];
    },
  },

  // ─── Lucid ─────────────────────────────────────────────────────
  {
    make: 'lucid',
    brand: 'Lucid',
    group: 'Lucid',
    supportsVinLookup: false,
    portalUrl: 'https://www.lucidmotors.com/owners-manual',
    yearRange: [2022, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.lucidmotors.com/owners-manual/${slug}`,
      ];
    },
  },

  // ─── Mitsubishi ────────────────────────────────────────────────
  {
    make: 'mitsubishi',
    brand: 'Mitsubishi',
    group: 'Mitsubishi',
    supportsVinLookup: false,
    portalUrl: 'https://www.mitsubishicars.com/owners/resources/manuals',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.mitsubishicars.com/content/dam/mitsubishi-motors/us/owners/manuals/${v.year}-${slug}-owners-manual.pdf`,
      ];
    },
  },

  // ─── Land Rover / Jaguar (JLR) ────────────────────────────────
  {
    make: 'land rover',
    brand: 'Land Rover',
    group: 'JLR',
    supportsVinLookup: true,
    portalUrl: 'https://www.landroverusa.com/owners/manuals.html',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.landroverusa.com/content/dam/landrover/us/owners/manuals/${v.year}/${slug}/owners-handbook.pdf`,
        `https://topix.landrover.jlrext.com/topix/vehicle/lookupForm?vin=&model=${encodeURIComponent(v.model)}&year=${v.year}`,
      ];
    },
  },
  {
    make: 'jaguar',
    brand: 'Jaguar',
    group: 'JLR',
    supportsVinLookup: true,
    portalUrl: 'https://www.jaguarusa.com/owners/manuals.html',
    yearRange: [2005, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.jaguarusa.com/content/dam/jaguar/us/owners/manuals/${v.year}/${slug}/owners-handbook.pdf`,
      ];
    },
  },

  // ─── Polestar ──────────────────────────────────────────────────
  {
    make: 'polestar',
    brand: 'Polestar',
    group: 'Polestar',
    supportsVinLookup: false,
    portalUrl: 'https://www.polestar.com/us/manual/',
    yearRange: [2020, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.polestar.com/us/manual/${slug}/`,
      ];
    },
  },

  // ─── Maserati ──────────────────────────────────────────────────
  {
    make: 'maserati',
    brand: 'Maserati',
    group: 'Stellantis',
    supportsVinLookup: false,
    portalUrl: 'https://www.maserati.com/us/en/owners/manuals',
    yearRange: [2014, 0],
    generateCandidateUrls: (v) => stellantisCandidates('Maserati', v),
  },

  // ─── Buick (already in GM, but ensure coverage) ────────────────
  // (Covered above under GM Group)

  // ─── Acura (already above under Honda) ─────────────────────────

  // ─── Volkswagen special aliases ────────────────────────────────
  {
    make: 'vw',
    brand: 'Volkswagen',
    group: 'VAG',
    supportsVinLookup: true,
    portalUrl: 'https://www.vw.com/en/owners-and-services/about-my-vehicle/owners-manual.html',
    yearRange: [2012, 0],
    generateCandidateUrls: (v) => {
      const slug = slugify(v.model);
      return [
        `https://www.vw.com/content/dam/vw/owners/manuals/${v.year}_${titleCase(v.model)}_OM.pdf`,
        `https://ownersmanuals2.com/volkswagen/${slug}-${v.year}-owners-manual`,
      ];
    },
  },
];

// ---------------------------------------------------------------------------
// Lookup index (keyed by normalized make)
// ---------------------------------------------------------------------------

const _sourceIndex = new Map<string, OemManualSource>();
for (const src of OEM_SOURCES) {
  _sourceIndex.set(src.make.toLowerCase(), src);
}

// Common aliases
const MAKE_ALIASES: Record<string, string> = {
  'mercedes': 'mercedes-benz',
  'merc': 'mercedes-benz',
  'mb': 'mercedes-benz',
  'chevy': 'chevrolet',
  'landrover': 'land rover',
  'alfa': 'alfa romeo',
  'alfaromeo': 'alfa romeo',
  'vw': 'volkswagen',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up OEM source data for a vehicle make.
 * Handles aliases (e.g. "Chevy" → Chevrolet, "MB" → Mercedes-Benz).
 */
export function getOemSource(make: string): OemManualSource | null {
  const key = make.toLowerCase().trim();
  return _sourceIndex.get(key) || _sourceIndex.get(MAKE_ALIASES[key] || '') || null;
}

/**
 * Generate all candidate PDF URLs for a vehicle from OEM patterns.
 * Returns URLs in priority order (most likely first).
 */
export function generateOemCandidateUrls(vehicle: VehicleLookup): string[] {
  const source = getOemSource(vehicle.make);
  if (!source) return [];

  // Check year range
  const [minYear, maxYear] = source.yearRange;
  if (vehicle.year < minYear) return [];
  if (maxYear > 0 && vehicle.year > maxYear) return [];

  const normalizedVehicle = source.modelNormalizer
    ? { ...vehicle, model: source.modelNormalizer(vehicle.model) }
    : vehicle;

  return source.generateCandidateUrls(normalizedVehicle);
}

/**
 * Get the owner portal URL for a manufacturer.
 * Useful as a fallback link for the user.
 */
export function getOemPortalUrl(make: string): string | null {
  const source = getOemSource(make);
  return source?.portalUrl || null;
}

/**
 * Check if a manufacturer supports VIN-based manual lookup.
 */
export function supportsVinLookup(make: string): boolean {
  const source = getOemSource(make);
  return source?.supportsVinLookup ?? false;
}

/**
 * Get all supported manufacturer names.
 */
export function getSupportedMakes(): string[] {
  return OEM_SOURCES.map((s) => s.brand);
}

/**
 * Get total count of supported OEM sources.
 */
export function getOemSourceCount(): number {
  return OEM_SOURCES.length;
}
