import json
import datetime
import hashlib
from typing import Dict, Any, List, Optional
from sqlalchemy import (
    Column, 
    String, 
    Float, 
    Integer, 
    Boolean, 
    Text, 
    DateTime, 
    ForeignKey
)
from sqlalchemy.orm import relationship
from database import Base

class ParcelRecord(Base):
    __tablename__ = "parcels"

    id = Column(String(64), primary_key=True, index=True)
    ulpin = Column(String(14), unique=True, index=True, nullable=False) # 14-digit Bhu-Aadhaar
    title = Column(String(255), nullable=False)
    state = Column(String(64), nullable=False, default="Uttar Pradesh")
    state_code = Column(String(8), nullable=False, default="UP")
    district = Column(String(128), nullable=False)
    tehsil = Column(String(128), nullable=False)
    village = Column(String(128), nullable=False)
    lgd_code = Column(String(12), nullable=True) # Official 6-digit LGD Village code
    khata_number = Column(String(32), nullable=False, index=True)
    fasli_year = Column(String(64), nullable=False)
    
    # Classification & scanning context
    record_type = Column(String(64), default="Khasra-Khatauni")
    primary_language = Column(String(32), default="Hindi")
    original_document_url = Column(Text, nullable=True)
    scan_condition = Column(String(64), default="Archival Document Scan")
    estimated_year = Column(Integer, default=1984)

    # Area measurements
    total_stated_area_ha = Column(Float, nullable=False, default=0.0)
    total_stated_sq_m = Column(Float, nullable=False, default=0.0)
    total_biswa = Column(Float, nullable=False, default=0.0)
    total_stated_display = Column(String(255), nullable=False)
    
    # Cadastral map GeoJSON
    boundary_geojson = Column(Text, nullable=True)
    
    # Status & verification
    is_verified = Column(Boolean, default=False)
    verification_status = Column(String(32), default="IN_REVIEW") # OFFICER_APPROVED, IN_REVIEW, FLAGGED
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(String(64), nullable=True)
    overall_confidence = Column(Float, default=0.92)
    has_discrepancy = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Validation pipeline metadata
    file_sha256 = Column(String(64), nullable=True, index=True)
    extraction_source = Column(String(32), nullable=True)
    field_meta_json = Column(Text, nullable=True)   # per-field confidence / reasons / bbox / verified

    # Relationships
    owners = relationship("TenureHolder", back_populates="parcel", cascade="all, delete-orphan")
    plots = relationship("KhasraPlot", back_populates="parcel", cascade="all, delete-orphan")
    discrepancies = relationship("DiscrepancyEntry", back_populates="parcel", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogEntry", back_populates="parcel", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        pid_str = str(self.id)
        if self.state in ["Andhra Pradesh", "Telangana"] or "Adangal" in str(self.record_type) or "rec-py" in pid_str:
            khata_x, khata_y, khata_w, khata_h = 4.5, 26.5, 4.5, 5.5
            fasli_x, fasli_y, fasli_w, fasli_h = 74.0, 4.5, 16.0, 4.5
            area_x, area_y, area_w, area_h = 13.5, 38.0, 5.5, 6.0
        elif "rec-up-365" in pid_str:
            khata_x, khata_y, khata_w, khata_h = 18.39, 8.67, 6.11, 0.60
            fasli_x, fasli_y, fasli_w, fasli_h = 17.48, 8.06, 9.95, 0.60
            area_x, area_y, area_w, area_h = 78.64, 31.36, 6.55, 0.60
        elif "rec-up-861" in pid_str:
            khata_x, khata_y, khata_w, khata_h = 71.74, 4.83, 4.85, 0.60
            fasli_x, fasli_y, fasli_w, fasli_h = 42.63, 4.83, 6.00, 0.60
            area_x, area_y, area_w, area_h = 78.00, 15.42, 6.00, 0.60
        else:
            khata_x, khata_y, khata_w, khata_h = 14.0, 19.0, 4.0, 1.2
            fasli_x, fasli_y, fasli_w, fasli_h = 32.0, 19.0, 23.0, 1.2
            area_x, area_y, area_w, area_h = 60.5, 58.0, 6.0, 1.2

        out = {
            "id": self.id,
            "ulpin": self.ulpin,
            "title": self.title,
            "state": self.state,
            "stateCode": self.state_code,
            "district": self.district,
            "tehsil": self.tehsil,
            "village": self.village,
            "lgdCode": self.lgd_code,
            "recordType": self.record_type,
            "primaryLanguage": self.primary_language,
            "originalDocumentUrl": self.original_document_url or "/sample-scans/up-khasra.svg",
            "scanCondition": self.scan_condition,
            "estimatedYear": self.estimated_year,
            "khataNumber": {
                "key": "khataNumber",
                "label": "Khata Number",
                "regionalLabel": "खाता संख्या",
                "value": self.khata_number,
                "rawOcrValue": self.khata_number,
                "confidence": 0.99,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-khata",
                    "x": khata_x,
                    "y": khata_y,
                    "width": khata_w,
                    "height": khata_h,
                    "label": f"खाता {self.khata_number}"
                },
                "isVerified": self.is_verified,
            },
            "fasliYear": {
                "key": "fasliYear",
                "label": "Fasli Assessment Year",
                "regionalLabel": "फसली वर्ष",
                "value": self.fasli_year,
                "rawOcrValue": self.fasli_year,
                "confidence": 0.96,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-fasli",
                    "x": fasli_x,
                    "y": fasli_y,
                    "width": fasli_w,
                    "height": fasli_h,
                    "label": self.fasli_year[:15]
                },
                "isVerified": self.is_verified,
            },
            "totalStatedArea": {
                "key": "totalStatedArea",
                "label": "Total Stated Holding Area",
                "regionalLabel": "कुल दर्ज क्षेत्रफल",
                "value": self.total_stated_display,
                "rawOcrValue": f"{self.total_stated_area_ha:.4f} हे०",
                "confidence": 0.98,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-area",
                    "x": area_x,
                    "y": area_y,
                    "width": area_w,
                    "height": area_h,
                    "label": f"कुल {self.total_stated_area_ha:.4f} हे०"
                },
                "isVerified": self.is_verified,
                "hasDiscrepancy": self.has_discrepancy,
            },
            "totalStatedAreaInSqMeters": self.total_stated_sq_m,
            "boundaryGeoJson": json.loads(self.boundary_geojson) if self.boundary_geojson else None,
            "overallConfidence": self.overall_confidence,
            "verificationStatus": self.verification_status,
            "isVerified": self.is_verified,
            "approvedBy": self.approved_by,
            "approvedAt": self.approved_at,
            "owners": [o.to_dict() for o in self.owners],
            "plots": [p.to_dict() for p in self.plots],
            "discrepancies": [d.to_dict() for d in self.discrepancies],
            "auditTrail": [a.to_dict() for a in self.audit_logs],
        }
        return apply_field_meta(out, self.field_meta_json, self.is_verified, self.extraction_source)


class TenureHolder(Base):
    __tablename__ = "tenure_holders"

    id = Column(String(64), primary_key=True)
    parcel_id = Column(String(64), ForeignKey("parcels.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    relation_type = Column(String(16), default="s/o")
    relative_name = Column(String(128), nullable=False)
    share_fraction = Column(String(32), default="1/3")
    share_percentage = Column(Float, default=33.33)
    individual_ha = Column(Float, default=0.0)
    individual_sq_m = Column(Float, default=0.0)
    individual_biswa = Column(Float, default=0.0)
    mobile_number = Column(String(20), nullable=True, index=True)
    confidence = Column(Float, default=0.98)
    confidence_tier = Column(String(16), default="high") # high, medium, low
    is_verified = Column(Boolean, default=True)
    raw_ocr_value = Column(String(255), nullable=True)
    discrepancy_note = Column(Text, nullable=True)
    bbox_x = Column(Float, default=12.0)
    bbox_y = Column(Float, default=30.0)
    bbox_w = Column(Float, default=28.0)
    bbox_h = Column(Float, default=5.0)

    parcel = relationship("ParcelRecord", back_populates="owners")

    def to_dict(self) -> Dict[str, Any]:
        is_telugu = (self.parcel and (self.parcel.state in ["Andhra Pradesh", "Telangana"] or "Adangal" in str(self.parcel.record_type))) or "rec-py" in str(self.parcel_id)
        pid_str = str(self.parcel_id)
        if is_telugu:
            rel_x = 67.5
            rel_y = round(self.bbox_y + 7.0, 2)
            rel_w = 18.5
            rel_h = 6.0
            share_x = 57.0
            share_y = self.bbox_y
            share_w = 9.0
            share_h = 6.5
        elif "rec-up-365" in pid_str:
            rel_x = self.bbox_x
            rel_y = round(self.bbox_y + 0.45, 2)
            rel_w = self.bbox_w
            rel_h = self.bbox_h
            share_x = 78.64
            share_y = self.bbox_y
            share_w = 6.55
            share_h = self.bbox_h
        elif "rec-up-861" in pid_str:
            rel_x = self.bbox_x
            rel_y = round(self.bbox_y + 0.60, 2)
            rel_w = self.bbox_w
            rel_h = self.bbox_h
            share_x = 75.0
            share_y = self.bbox_y
            share_w = 10.0
            share_h = self.bbox_h
        else:
            rel_x = 17.5
            rel_y = self.bbox_y
            rel_w = 7.5
            rel_h = self.bbox_h
            share_x = 27.5
            share_y = self.bbox_y
            share_w = 11.5
            share_h = self.bbox_h

        return {
            "id": self.id,
            "name": {
                "key": f"{self.id}-name",
                "label": "Primary Tenure Holder",
                "regionalLabel": "खातेदार का नाम",
                "value": self.name,
                "rawOcrValue": self.raw_ocr_value or self.name,
                "confidence": self.confidence,
                "confidenceTier": self.confidence_tier,
                "boundingBox": {
                    "id": f"bb-{self.id}-name",
                    "x": self.bbox_x,
                    "y": self.bbox_y,
                    "width": self.bbox_w,
                    "height": self.bbox_h,
                    "label": self.name
                },
                "isVerified": self.is_verified,
                "discrepancyNote": self.discrepancy_note
            },
            "relationType": self.relation_type,
            "relativeName": {
                "key": f"{self.id}-rel",
                "label": "Father/Guardian Name",
                "regionalLabel": "पिता का नाम",
                "value": self.relative_name,
                "rawOcrValue": self.relative_name,
                "confidence": self.confidence,
                "confidenceTier": self.confidence_tier,
                "boundingBox": {
                    "id": f"bb-{self.id}-rel",
                    "x": rel_x,
                    "y": rel_y,
                    "width": rel_w,
                    "height": rel_h,
                    "label": self.relative_name
                },
                "isVerified": self.is_verified,
            },
            "shareFraction": {
                "key": f"{self.id}-share",
                "label": "Holding Share",
                "regionalLabel": "अंश / भाग",
                "value": self.share_fraction,
                "rawOcrValue": self.share_fraction,
                "confidence": 0.99,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-share",
                    "x": share_x,
                    "y": share_y,
                    "width": share_w,
                    "height": share_h,
                    "label": self.share_fraction
                },
                "isVerified": self.is_verified,
            },
            "individualHa": self.individual_ha,
            "individualSqM": self.individual_sq_m,
            "individualBiswa": self.individual_biswa,
            "mobileNumber": self.mobile_number,
        }


class KhasraPlot(Base):
    __tablename__ = "khasra_plots"

    id = Column(String(64), primary_key=True)
    parcel_id = Column(String(64), ForeignKey("parcels.id"), nullable=False, index=True)
    gata_number = Column(String(32), nullable=False)
    area_ha = Column(Float, nullable=False, default=0.0)
    area_sq_m = Column(Float, nullable=False, default=0.0)
    area_biswa = Column(Float, nullable=False, default=0.0)
    area_display = Column(String(128), nullable=False)
    land_classification = Column(String(255), default="श्रेणी 1-क · संक्रमणीय भूमिधर")
    annual_tax_cess = Column(String(32), default="₹ 0.01")
    
    # Chauhaddi boundaries
    chauhaddi_north = Column(String(128), nullable=True)
    chauhaddi_south = Column(String(128), nullable=True)
    chauhaddi_east = Column(String(128), nullable=True)
    chauhaddi_west = Column(String(128), nullable=True)
    has_road_access = Column(Boolean, default=True)
    confidence = Column(Float, default=0.98)
    confidence_tier = Column(String(16), default="high")
    bbox_x = Column(Float, default=10.0)
    bbox_y = Column(Float, default=50.0)
    bbox_w = Column(Float, default=84.0)
    bbox_h = Column(Float, default=8.0)

    parcel = relationship("ParcelRecord", back_populates="plots")

    def to_dict(self) -> Dict[str, Any]:
        pid_str = str(self.parcel_id)
        is_telugu = (self.parcel and (self.parcel.state in ["Andhra Pradesh", "Telangana"] or "Adangal" in str(self.parcel.record_type))) or "rec-py" in pid_str
        if is_telugu:
            no_x = self.bbox_x
            no_y = self.bbox_y
            no_w = self.bbox_w
            no_h = self.bbox_h
            area_x = 14.0
            area_y = self.bbox_y
            area_w = 4.5
            area_h = self.bbox_h
            class_x = 35.0
            class_y = self.bbox_y
            class_w = 8.0
            class_h = self.bbox_h
            tax_x = 42.0
            tax_y = self.bbox_y
            tax_w = 6.0
            tax_h = self.bbox_h
        elif "rec-up-365" in pid_str:
            no_x = self.bbox_x
            no_y = self.bbox_y
            no_w = self.bbox_w
            no_h = self.bbox_h
            area_x = 78.64
            area_y = self.bbox_y
            area_w = 6.55
            area_h = self.bbox_h
            class_x = 6.5
            class_y = 20.5
            class_w = 38.0
            class_h = 0.6
            tax_x = 65.0
            tax_y = self.bbox_y
            tax_w = 8.0
            tax_h = self.bbox_h
        elif "rec-up-861" in pid_str:
            no_x = self.bbox_x
            no_y = self.bbox_y
            no_w = self.bbox_w
            no_h = self.bbox_h
            area_x = 78.0
            area_y = self.bbox_y
            area_w = 6.0
            area_h = self.bbox_h
            class_x = 6.5
            class_y = 10.5
            class_w = 38.0
            class_h = 0.6
            tax_x = 65.0
            tax_y = self.bbox_y
            tax_w = 8.0
            tax_h = self.bbox_h
        else:
            no_x = 50.0
            no_y = self.bbox_y
            no_w = 4.5
            no_h = self.bbox_h
            area_x = 60.5
            area_y = self.bbox_y
            area_w = 6.0
            area_h = self.bbox_h
            class_x = 6.5
            class_y = 54.2
            class_w = 42.0
            class_h = 1.2
            tax_x = 68.0
            tax_y = self.bbox_y
            tax_w = 6.0
            tax_h = self.bbox_h

        return {
            "id": self.id,
            "khasraNumber": {
                "key": f"{self.id}-khasra",
                "label": "Gata / Khasra No.",
                "regionalLabel": "गाटा / खसरा संख्या",
                "value": f"गाटा {self.gata_number}",
                "rawOcrValue": self.gata_number,
                "confidence": self.confidence,
                "confidenceTier": self.confidence_tier,
                "boundingBox": {
                    "id": f"bb-{self.id}-no",
                    "x": no_x,
                    "y": no_y,
                    "width": no_w,
                    "height": no_h,
                    "label": f"खसरा {self.gata_number}"
                },
                "isVerified": True,
            },
            "regionalAreaText": {
                "key": f"{self.id}-area",
                "label": "Plot Area",
                "regionalLabel": "क्षेत्रफल",
                "value": self.area_display,
                "rawOcrValue": f"{self.area_ha:.4f} हे०",
                "confidence": self.confidence,
                "confidenceTier": self.confidence_tier,
                "boundingBox": {
                    "id": f"bb-{self.id}-area",
                    "x": area_x,
                    "y": area_y,
                    "width": area_w,
                    "height": area_h,
                    "label": self.area_display
                },
                "isVerified": True,
            },
            "areaInSqMeters": self.area_sq_m,
            "areaInHectares": self.area_ha,
            "landClassification": {
                "key": f"{self.id}-class",
                "label": "Classification",
                "regionalLabel": "भूमि की श्रेणी (अधिकार)",
                "value": self.land_classification,
                "rawOcrValue": self.land_classification,
                "confidence": 0.98,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-class",
                    "x": class_x,
                    "y": class_y,
                    "width": class_w,
                    "height": class_h,
                    "label": "श्रेणी 1-क"
                },
                "isVerified": True,
            },
            "annualRevenueLagaan": {
                "key": f"{self.id}-tax",
                "label": "Revenue Cess",
                "regionalLabel": "वार्षिक लगान (मालगुजारी)",
                "value": self.annual_tax_cess,
                "rawOcrValue": self.annual_tax_cess,
                "confidence": 0.95,
                "confidenceTier": "high",
                "boundingBox": {
                    "id": f"bb-{self.id}-tax",
                    "x": tax_x,
                    "y": tax_y,
                    "width": tax_w,
                    "height": tax_h,
                    "label": self.annual_tax_cess
                },
                "isVerified": True,
            },
            "boundingBox": {
                "id": f"bb-{self.id}-row",
                "x": no_x,
                "y": no_y,
                "width": 17.0 if not is_telugu else 88.0,
                "height": no_h,
                "label": f"खसरा {self.gata_number} पंक्ति"
            },
            "chauhaddi": {
                "north": self.chauhaddi_north,
                "south": self.chauhaddi_south,
                "east": self.chauhaddi_east,
                "west": self.chauhaddi_west,
            },
            "hasRoadAccess": self.has_road_access,
        }


class DiscrepancyEntry(Base):
    __tablename__ = "discrepancies"

    id = Column(String(64), primary_key=True)
    parcel_id = Column(String(64), ForeignKey("parcels.id"), nullable=False, index=True)
    field_key = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(16), default="medium") # high, medium, low
    suggested_action = Column(Text, nullable=False)
    status = Column(String(32), default="PENDING_REVIEW") # PENDING_REVIEW, RESOLVED

    parcel = relationship("ParcelRecord", back_populates="discrepancies")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "fieldKey": self.field_key,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "suggestedAction": self.suggested_action,
            "status": self.status,
        }


class AuditLogEntry(Base):
    __tablename__ = "audit_trail"

    id = Column(String(64), primary_key=True)
    parcel_id = Column(String(64), ForeignKey("parcels.id"), nullable=False, index=True)
    timestamp = Column(String(64), nullable=False)
    officer_id = Column(String(64), default="SYSTEM")
    officer_name = Column(String(128), default="System")
    officer_designation = Column(String(128), default="Automated pipeline")
    action = Column(String(64), nullable=False)
    field_label = Column(String(128), nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    sha256_hash = Column(String(64), nullable=False)
    seq = Column(Integer, nullable=True, index=True)        # position in the global hash chain
    prev_hash = Column(String(64), nullable=True)           # hash of the entry before this one

    parcel = relationship("ParcelRecord", back_populates="audit_logs")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "officerId": self.officer_id,
            "officerName": self.officer_name,
            "officerDesignation": self.officer_designation,
            "action": self.action,
            "fieldLabel": self.field_label,
            "oldValue": self.old_value,
            "newValue": self.new_value,
            "integrityHash": self.sha256_hash,
            "previousHash": self.prev_hash,
            "chainSeq": self.seq,
        }


def apply_field_meta(out: Dict[str, Any], meta_json: Optional[str], parcel_verified: bool,
                     extraction_source: Optional[str]) -> Dict[str, Any]:
    """
    Overlay the confidence computed by validation_engine onto the serialized record.
    Paths: 'khataNumber', 'owners.0.name', 'plots.1.regionalAreaText', ...
    Officer-approved parcels show every field as verified.
    """
    meta = {}
    if meta_json:
        try:
            meta = json.loads(meta_json)
        except Exception:
            meta = {}
    fmeta = meta.get("fields", {})

    def overlay(path: str, field: Dict[str, Any]):
        if not isinstance(field, dict):
            return
        m = fmeta.get(path)
        if m:
            for k in ("confidence", "confidenceTier", "confidenceReasons", "discrepancyNote",
                      "isVerified", "verifiedBy", "verifiedAt", "hasDiscrepancy", "learnedCorrection"):
                if k in m:
                    field[k] = m[k]
            if m.get("boundingBox") and m.get("hasBoundingBox"):
                field["boundingBox"] = {**field.get("boundingBox", {}), **m["boundingBox"]}
            field["hasBoundingBox"] = bool(m.get("hasBoundingBox"))
        if parcel_verified:
            field["isVerified"] = True

    for k in ("khataNumber", "fasliYear", "totalStatedArea"):
        overlay(k, out.get(k))
    for i, o in enumerate(out.get("owners", [])):
        for k in ("name", "relativeName", "shareFraction"):
            overlay(f"owners.{i}.{k}", o.get(k))
    for i, p in enumerate(out.get("plots", [])):
        for k in ("khasraNumber", "regionalAreaText", "landClassification", "annualRevenueLagaan"):
            overlay(f"plots.{i}.{k}", p.get(k))

    if meta:
        for k in ("crossVerification", "lrmsVerification", "confidenceSummary", "reviewReasons",
                  "needsReview"):
            if k in meta:
                out[k] = meta[k]
    out["extractionSource"] = extraction_source or "seed"
    return out


class LrmsMasterRecord(Base):
    """
    MOCK Land Records Management System master table (sandbox stand-in for the
    state LRMS / DILRMP database). Every upload is cross-verified against this.
    """
    __tablename__ = "lrms_master"

    id = Column(String(64), primary_key=True)
    state = Column(String(64), nullable=False)
    district = Column(String(128), nullable=False)
    tehsil = Column(String(128), nullable=True)
    village = Column(String(128), nullable=False, index=True)
    khata = Column(String(32), nullable=False, index=True)
    khasras_json = Column(Text, nullable=False)   # ["32", "861"]
    owners_json = Column(Text, nullable=False)    # ["शिवसरन", ...]
    total_sq_m = Column(Float, nullable=True)
    source = Column(String(64), default="MOCK_LRMS_SANDBOX")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id, "state": self.state, "district": self.district,
            "tehsil": self.tehsil, "village": self.village, "khata": self.khata,
            "khasras": json.loads(self.khasras_json or "[]"),
            "owners": json.loads(self.owners_json or "[]"),
            "total_sq_m": self.total_sq_m, "source": self.source,
        }
