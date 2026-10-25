export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface BoundingBox {
  id: string;
  x: number; // percentage (0-100) or pixel coordinate relative to original scan
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface ExtractedField<T = string> {
  key: string;
  label: string;
  regionalLabel?: string; // Hindi/Marathi name e.g. "खाता संख्या"
  value: T;
  rawOcrValue: string;
  confidence: number; // 0.00 to 1.00
  confidenceTier: ConfidenceTier;
  boundingBox: BoundingBox;
  isVerified: boolean;
  verifiedValue?: T;
  verifiedBy?: string;
  verifiedAt?: string;
  hasDiscrepancy?: boolean;
  discrepancyNote?: string;
}

export interface OwnerRecord {
  id: string;
  name: ExtractedField<string>;
  relationType: 's/o' | 'w/o' | 'd/o' | 'c/o' | 'h/o';
  relativeName: ExtractedField<string>;
  shareFraction: ExtractedField<string>; // e.g. "1/2", "33.3%"
  aadhaarVaultToken?: string; // Privacy compliant token
}

export interface SubplotParcel {
  id: string;
  khasraNumber: ExtractedField<string>; // Plot number
  regionalAreaText: ExtractedField<string>; // e.g. "1 Bigha 12 Biswa" or "0.45 Hectare"
  areaInSqMeters: number;
  areaInHectares: number;
  landClassification: ExtractedField<string>; // e.g. "Chahi (Irrigated)", "Barani (Rainfed)"
  annualRevenueLagaan: ExtractedField<string>; // Revenue tax cess
  boundingBox: BoundingBox;
}

export interface RevenueDiscrepancy {
  id: string;
  fieldKey: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
  status: 'PENDING_REVIEW' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  officerId: string;
  officerName: string;
  officerDesignation: string;
  action: 'FIELD_EDITED' | 'CONFIRMED_MATCH' | 'DISCREPANCY_OVERRIDDEN' | 'FINAL_DIGITIZATION_SIGN_OFF';
  fieldLabel?: string;
  oldValue?: string;
  newValue?: string;
  justification?: string;
  integrityHash: string; // SHA-256 representation
}

export interface LandRecordDocument {
  id: string;
  title: string;
  state: string;
  stateCode: string;
  district: string;
  tehsil: string;
  village: string;
  recordType: 'Khasra-Khatauni' | '7/12 Extract (Saat-Baara)' | 'Jamabandi' | 'Patta/Chitta';
  primaryLanguage: 'Hindi' | 'Marathi' | 'Tamil' | 'English';
  originalDocumentUrl: string; // Base64 or SVG / Canvas render template
  scanCondition: 'Faded Handwritten' | 'Torn / Skewed Scan' | 'Archival Blue-Ink' | 'Standard Digital Scan';
  estimatedYear: number;
  
  // Header details
  khataNumber: ExtractedField<string>;
  khewatNumber?: ExtractedField<string>;
  fasliYear: ExtractedField<string>; // Agricultural revenue year e.g. 1431 Fasli (2023-2024)

  // Owners list
  owners: OwnerRecord[];

  // Total stated area
  totalStatedArea: ExtractedField<string>;
  totalStatedAreaInSqMeters: number;

  // Breakdown parcels
  plots: SubplotParcel[];

  // Integrity checks
  discrepancies: RevenueDiscrepancy[];
  overallConfidence: number; // e.g. 88%
  verificationStatus: 'DRAFT_AI_EXTRACTION' | 'IN_REVIEW' | 'OFFICER_APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;

  // Audit trail
  auditTrail: AuditLogEntry[];
}
