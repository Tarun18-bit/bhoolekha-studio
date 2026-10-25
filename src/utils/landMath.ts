/**
 * Indian Revenue Measurement & Sanity Math Engine
 * Converts historical and regional units to standard SI Metric (Sq. Meters & Hectares)
 * and detects discrepancies in sub-parcel subdivisions.
 */

export interface LandUnitConversion {
  sqMeters: number;
  hectares: number;
  acres: number;
  standardizedDisplay: string;
}

/**
 * Standard unit constants (SI basis)
 */
export const UNIT_CONSTANTS = {
  // Metric
  HECTARE_TO_SQ_M: 10000,
  ARE_TO_SQ_M: 100,
  ACRE_TO_SQ_M: 4046.86,

  // Northern India (UP, Uttarakhand, Bihar, MP) - Standard Pucca Bigha
  PUCCA_BIGHA_TO_SQ_M: 2529.285, // 1 Bigha = 3025 sq yards
  BISWA_TO_SQ_M: 126.464,       // 20 Biswa = 1 Bigha
  BISWANSI_TO_SQ_M: 6.323,      // 20 Biswansi = 1 Biswa

  // Western India (Maharashtra, Gujarat, Karnataka)
  GUNTHA_TO_SQ_M: 101.171,      // 40 Guntha = 1 Acre

  // North-West (Punjab, Haryana, HP)
  KANAL_TO_SQ_M: 505.857,       // 8 Kanal = 1 Acre
  MARLA_TO_SQ_M: 25.292,        // 20 Marla = 1 Kanal

  // Southern India (Tamil Nadu, Kerala, AP)
  CENT_TO_SQ_M: 40.468,         // 100 Cent = 1 Acre
  GROUND_TO_SQ_M: 222.96,       // 2400 sq ft
};

/**
 * Parses freeform regional land strings e.g. "2 Bigha 4 Biswa", "1.45 Hectare", "18 Guntha"
 */
export function parseRegionalLandArea(input: string, _state: string = 'Uttar Pradesh'): LandUnitConversion {
  const clean = (input || '').trim().toLowerCase();

  let sqMeters = 0;

  // Pattern 1: Hectares / Aare
  if (clean.includes('hectare') || clean.includes('हेक्टेयर') || clean.includes('hec') || clean.includes('h.')) {
    const match = clean.match(/([\d.]+)\s*(hectare|हेक्टेयर|hec|h)/);
    if (match && match[1]) {
      sqMeters += parseFloat(match[1]) * UNIT_CONSTANTS.HECTARE_TO_SQ_M;
    }
  }

  // Pattern 2: Bigha and Biswa (UP / Bihar / MP)
  if (clean.includes('bigha') || clean.includes('बीघा')) {
    const bighaMatch = clean.match(/([\d.]+)\s*(bigha|बीघा)/);
    if (bighaMatch && bighaMatch[1]) {
      sqMeters += parseFloat(bighaMatch[1]) * UNIT_CONSTANTS.PUCCA_BIGHA_TO_SQ_M;
    }
  }

  if (clean.includes('biswa') || clean.includes('बिस्वा')) {
    const biswaMatch = clean.match(/([\d.]+)\s*(biswa|बिस्वा)/);
    if (biswaMatch && biswaMatch[1]) {
      sqMeters += parseFloat(biswaMatch[1]) * UNIT_CONSTANTS.BISWA_TO_SQ_M;
    }
  }

  // Pattern 3: Guntha / Acre (Maharashtra / Gujarat)
  if (clean.includes('guntha') || clean.includes('गुंठा')) {
    const gunthaMatch = clean.match(/([\d.]+)\s*(guntha|गुंठा)/);
    if (gunthaMatch && gunthaMatch[1]) {
      sqMeters += parseFloat(gunthaMatch[1]) * UNIT_CONSTANTS.GUNTHA_TO_SQ_M;
    }
  }

  if (clean.includes('acre') || clean.includes('एकड़')) {
    const acreMatch = clean.match(/([\d.]+)\s*(acre|एकड़)/);
    if (acreMatch && acreMatch[1]) {
      sqMeters += parseFloat(acreMatch[1]) * UNIT_CONSTANTS.ACRE_TO_SQ_M;
    }
  }

  // Fallback: If pure decimal number with no recognized keyword, assume Hectare for modern digital records
  if (sqMeters === 0) {
    const numericMatch = clean.match(/^([\d.]+)$/);
    if (numericMatch && numericMatch[1]) {
      sqMeters = parseFloat(numericMatch[1]) * UNIT_CONSTANTS.HECTARE_TO_SQ_M;
    }
  }

  const hectares = Number((sqMeters / UNIT_CONSTANTS.HECTARE_TO_SQ_M).toFixed(4));
  const acres = Number((sqMeters / UNIT_CONSTANTS.ACRE_TO_SQ_M).toFixed(3));

  return {
    sqMeters: Math.round(sqMeters * 100) / 100,
    hectares,
    acres,
    standardizedDisplay: `${hectares.toLocaleString()} Ha (${sqMeters.toLocaleString()} m²)`,
  };
}

/**
 * Validates whether the sum of sub-plots matches the recorded total plot area
 */
export function checkParcelArithmetic(totalStatedSqMeters: number, subPlotsSqMeters: number[]): {
  isConsistent: boolean;
  discrepancySqMeters: number;
  percentageVariance: number;
  message: string;
} {
  const sumSubPlots = subPlotsSqMeters.reduce((acc, curr) => acc + curr, 0);
  const diff = Math.round((sumSubPlots - totalStatedSqMeters) * 100) / 100;
  const absDiff = Math.abs(diff);

  // Allowance of 1 sq meter for rounding differences in legacy records
  if (absDiff <= 1.0) {
    return {
      isConsistent: true,
      discrepancySqMeters: 0,
      percentageVariance: 0,
      message: 'Sub-parcel areas perfectly match stated total area.',
    };
  }

  const percentageVariance = Number(((absDiff / (totalStatedSqMeters || 1)) * 100).toFixed(2));
  const isOverage = diff > 0;

  return {
    isConsistent: false,
    discrepancySqMeters: diff,
    percentageVariance,
    message: isOverage
      ? `Sub-parcel sum (${sumSubPlots.toLocaleString()} m²) exceeds recorded total (${totalStatedSqMeters.toLocaleString()} m²) by ${absDiff} m² (+${percentageVariance}%). Possible unregistered partition or transcription mistake.`
      : `Sub-parcel sum (${sumSubPlots.toLocaleString()} m²) falls short of recorded total (${totalStatedSqMeters.toLocaleString()} m²) by ${absDiff} m² (-${percentageVariance}%). Missing plot entry or unallotted holding.`,
  };
}
