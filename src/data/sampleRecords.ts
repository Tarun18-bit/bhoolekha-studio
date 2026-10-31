import type { LandRecordDocument } from '../types/landRecord';

export const SAMPLE_RECORDS: LandRecordDocument[] = [
  {
    "id": "rec-up-jaunpur-548",
    "ulpin": "UPJAU0003200548",
    "title": "उत्तर प्रदेश भूलेख खतौनी - ग्राम: हीरापुरमचहटी (जौनपुर)",
    "state": "Uttar Pradesh",
    "stateCode": "UP",
    "district": "Jaunpur (जौनपुर)",
    "tehsil": "Kerakat (केराकत)",
    "village": "हीरापुरमचहटी (Heerapur Machhati)",
    "lgdCode": "192831",
    "recordType": "Khasra-Khatauni",
    "primaryLanguage": "Hindi",
    "originalDocumentUrl": "/sample-scans/jaunpur-khatauni.jpg",
    "scanCondition": "Standard Digital Scan",
    "estimatedYear": 2026,
    "khataNumber": {
      "key": "khataNumber",
      "label": "Khata Number",
      "regionalLabel": "खाता संख्या",
      "value": "00548",
      "rawOcrValue": "00548",
      "confidence": 0.99,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-jaunpur-548-khata",
        "x": 14.0,
        "y": 19.0,
        "width": 4.0,
        "height": 1.2,
        "label": "खाता 00548"
      },
      "isVerified": true
    },
    "fasliYear": {
      "key": "fasliYear",
      "label": "Fasli Assessment Year",
      "regionalLabel": "फसली वर्ष",
      "value": "1428 फसली -1433 (01 जुलाई, 2020 से 30 जून, 2026)",
      "rawOcrValue": "1428 फसली -1433 (01 जुलाई, 2020 से 30 जून, 2026)",
      "confidence": 0.96,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-jaunpur-548-fasli",
        "x": 32.0,
        "y": 19.0,
        "width": 23.0,
        "height": 1.2,
        "label": "1428 फसली -1433"
      },
      "isVerified": true
    },
    "totalStatedArea": {
      "key": "totalStatedArea",
      "label": "Total Stated Holding Area",
      "regionalLabel": "कुल दर्ज क्षेत्रफल",
      "value": "0.8290 हेक्टेयर (8,290 वर्ग मीटर · लगभग 65.6 बिस्वा)",
      "rawOcrValue": "0.8290 हे०",
      "confidence": 0.98,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-jaunpur-548-area",
        "x": 60.5,
        "y": 58.0,
        "width": 6.0,
        "height": 1.2,
        "label": "कुल 0.8290 हे०"
      },
      "isVerified": true,
      "hasDiscrepancy": true
    },
    "totalStatedAreaInSqMeters": 8290.0,
    "boundaryGeoJson": null,
    "overallConfidence": 0.98,
    "verificationStatus": "OFFICER_APPROVED",
    "isVerified": true,
    "approvedBy": "Naib Tehsildar R. K. Mishra (Pindra Subdivision)",
    "approvedAt": "2026-10-30 01:05 IST",
    "owners": [
      {
        "id": "rec-up-jaunpur-548-o1",
        "name": {
          "key": "rec-up-jaunpur-548-o1-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "शिवसरन",
          "rawOcrValue": "शिवसरन",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o1-name",
            "x": 9.2,
            "y": 58.17,
            "width": 7.2,
            "height": 0.95,
            "label": "शिवसरन"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o1-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "मुरली",
          "rawOcrValue": "मुरली",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o1-rel",
            "x": 17.5,
            "y": 58.17,
            "width": 7.5,
            "height": 0.95,
            "label": "मुरली"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o1-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o1-share",
            "x": 27.5,
            "y": 58.17,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o2",
        "name": {
          "key": "rec-up-jaunpur-548-o2-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "भोला",
          "rawOcrValue": "भोला",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o2-name",
            "x": 9.2,
            "y": 59.23,
            "width": 7.2,
            "height": 0.95,
            "label": "भोला"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o2-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "मुरली",
          "rawOcrValue": "मुरली",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o2-rel",
            "x": 17.5,
            "y": 59.23,
            "width": 7.5,
            "height": 0.95,
            "label": "मुरली"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o2-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o2-share",
            "x": 27.5,
            "y": 59.23,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o3",
        "name": {
          "key": "rec-up-jaunpur-548-o3-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "भोभल",
          "rawOcrValue": "भोभल",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o3-name",
            "x": 9.2,
            "y": 60.3,
            "width": 7.2,
            "height": 0.95,
            "label": "भोभल"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o3-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "मुरली",
          "rawOcrValue": "मुरली",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o3-rel",
            "x": 17.5,
            "y": 60.3,
            "width": 7.5,
            "height": 0.95,
            "label": "मुरली"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o3-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o3-share",
            "x": 27.5,
            "y": 60.3,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o4",
        "name": {
          "key": "rec-up-jaunpur-548-o4-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "टुडी",
          "rawOcrValue": "टूड़ी",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o4-name",
            "x": 9.2,
            "y": 61.37,
            "width": 7.2,
            "height": 0.95,
            "label": "टुडी"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o4-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "हरिनाथ",
          "rawOcrValue": "हरिनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o4-rel",
            "x": 17.5,
            "y": 61.37,
            "width": 7.5,
            "height": 0.95,
            "label": "हरिनाथ"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o4-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o4-share",
            "x": 27.5,
            "y": 61.37,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o5",
        "name": {
          "key": "rec-up-jaunpur-548-o5-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "बांके",
          "rawOcrValue": "बांके",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o5-name",
            "x": 9.2,
            "y": 62.44,
            "width": 7.2,
            "height": 0.95,
            "label": "बांके"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o5-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "हरिनाथ",
          "rawOcrValue": "हरिनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o5-rel",
            "x": 17.5,
            "y": 62.44,
            "width": 7.5,
            "height": 0.95,
            "label": "हरिनाथ"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o5-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o5-share",
            "x": 27.5,
            "y": 62.44,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o6",
        "name": {
          "key": "rec-up-jaunpur-548-o6-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "हवलदार",
          "rawOcrValue": "हवलदार",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o6-name",
            "x": 9.2,
            "y": 63.51,
            "width": 7.2,
            "height": 0.95,
            "label": "हवलदार"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o6-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "हरिनाथ",
          "rawOcrValue": "हरिनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o6-rel",
            "x": 17.5,
            "y": 63.51,
            "width": 7.5,
            "height": 0.95,
            "label": "हरिनाथ"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o6-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o6-share",
            "x": 27.5,
            "y": 63.51,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o7",
        "name": {
          "key": "rec-up-jaunpur-548-o7-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "हरिनाथ",
          "rawOcrValue": "हरिनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o7-name",
            "x": 9.2,
            "y": 64.58,
            "width": 7.2,
            "height": 0.95,
            "label": "हरिनाथ"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o7-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "जगपति",
          "rawOcrValue": "जगपति",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o7-rel",
            "x": 17.5,
            "y": 64.58,
            "width": 7.5,
            "height": 0.95,
            "label": "जगपति"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o7-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o7-share",
            "x": 27.5,
            "y": 64.58,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o8",
        "name": {
          "key": "rec-up-jaunpur-548-o8-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "रामआसरे",
          "rawOcrValue": "रामआसरे",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o8-name",
            "x": 9.2,
            "y": 65.65,
            "width": 7.2,
            "height": 0.95,
            "label": "रामआसरे"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o8-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "देवराज",
          "rawOcrValue": "देवराज",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o8-rel",
            "x": 17.5,
            "y": 65.65,
            "width": 7.5,
            "height": 0.95,
            "label": "देवराज"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o8-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o8-share",
            "x": 27.5,
            "y": 65.65,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o9",
        "name": {
          "key": "rec-up-jaunpur-548-o9-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "कमलेश",
          "rawOcrValue": "कमलेश",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o9-name",
            "x": 9.2,
            "y": 66.72,
            "width": 7.2,
            "height": 0.95,
            "label": "कमलेश"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o9-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "देवराज",
          "rawOcrValue": "देवराज",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o9-rel",
            "x": 17.5,
            "y": 66.72,
            "width": 7.5,
            "height": 0.95,
            "label": "देवराज"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o9-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o9-share",
            "x": 27.5,
            "y": 66.72,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o10",
        "name": {
          "key": "rec-up-jaunpur-548-o10-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "मोहन",
          "rawOcrValue": "मोहन",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o10-name",
            "x": 9.2,
            "y": 67.79,
            "width": 7.2,
            "height": 0.95,
            "label": "मोहन"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o10-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "इन्द्रदेव",
          "rawOcrValue": "इन्द्रदेव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o10-rel",
            "x": 17.5,
            "y": 67.79,
            "width": 7.5,
            "height": 0.95,
            "label": "इन्द्रदेव"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o10-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o10-share",
            "x": 27.5,
            "y": 67.79,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o11",
        "name": {
          "key": "rec-up-jaunpur-548-o11-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "बिरजू",
          "rawOcrValue": "बिरजू",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o11-name",
            "x": 9.2,
            "y": 68.85,
            "width": 7.2,
            "height": 0.95,
            "label": "बिरजू"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o11-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "इन्द्रदेव",
          "rawOcrValue": "इन्द्रदेव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o11-rel",
            "x": 17.5,
            "y": 68.85,
            "width": 7.5,
            "height": 0.95,
            "label": "इन्द्रदेव"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o11-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o11-share",
            "x": 27.5,
            "y": 68.85,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o12",
        "name": {
          "key": "rec-up-jaunpur-548-o12-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "सूर्यनाथ",
          "rawOcrValue": "सूर्यनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o12-name",
            "x": 9.2,
            "y": 70.8,
            "width": 7.2,
            "height": 0.95,
            "label": "सूर्यनाथ"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o12-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "इन्द्रदेव",
          "rawOcrValue": "इन्द्रदेव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o12-rel",
            "x": 17.5,
            "y": 70.8,
            "width": 7.5,
            "height": 0.95,
            "label": "इन्द्रदेव"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o12-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o12-share",
            "x": 27.5,
            "y": 70.8,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o13",
        "name": {
          "key": "rec-up-jaunpur-548-o13-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "अशोक",
          "rawOcrValue": "अशोक",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o13-name",
            "x": 9.2,
            "y": 71.95,
            "width": 7.2,
            "height": 0.95,
            "label": "अशोक"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o13-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "इन्द्रदेव",
          "rawOcrValue": "इन्द्रदेव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o13-rel",
            "x": 17.5,
            "y": 71.95,
            "width": 7.5,
            "height": 0.95,
            "label": "इन्द्रदेव"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o13-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o13-share",
            "x": 27.5,
            "y": 71.95,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      },
      {
        "id": "rec-up-jaunpur-548-o14",
        "name": {
          "key": "rec-up-jaunpur-548-o14-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "बांकेलाल",
          "rawOcrValue": "बांकेलाल",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o14-name",
            "x": 9.2,
            "y": 73.1,
            "width": 7.2,
            "height": 0.95,
            "label": "बांकेलाल"
          },
          "isVerified": true,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-jaunpur-548-o14-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "हरिनाथ",
          "rawOcrValue": "हरिनाथ",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o14-rel",
            "x": 17.5,
            "y": 73.1,
            "width": 7.5,
            "height": 0.95,
            "label": "हरिनाथ"
          },
          "isVerified": true
        },
        "shareFraction": {
          "key": "rec-up-jaunpur-548-o14-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "1/3 हिस्सा (समभाग)",
          "rawOcrValue": "1/3 हिस्सा (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-o14-share",
            "x": 27.5,
            "y": 73.1,
            "width": 11.5,
            "height": 0.95,
            "label": "1/3 हिस्सा (समभाग)"
          },
          "isVerified": true
        },
        "individualHa": 0.0592,
        "individualSqM": 592.1,
        "individualBiswa": 4.69,
        "mobileNumber": null
      }
    ],
    "plots": [
      {
        "id": "rec-up-jaunpur-548-p1",
        "khasraNumber": {
          "key": "rec-up-jaunpur-548-p1-khasra",
          "label": "Gata / Khasra No.",
          "regionalLabel": "गाटा / खसरा संख्या",
          "value": "गाटा 32",
          "rawOcrValue": "32",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-p1-no",
            "x": 50.0,
            "y": 58.0,
            "width": 4.5,
            "height": 1.2,
            "label": "खसरा 32"
          },
          "isVerified": true
        },
        "regionalAreaText": {
          "key": "rec-up-jaunpur-548-p1-area",
          "label": "Plot Area",
          "regionalLabel": "क्षेत्रफल",
          "value": "0.8290 हे० (8,290 वर्ग मीटर)",
          "rawOcrValue": "0.8290 हे०",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-p1-area",
            "x": 60.5,
            "y": 58.0,
            "width": 6.0,
            "height": 1.2,
            "label": "0.8290 हे० (8,290 वर्ग मीटर)"
          },
          "isVerified": true
        },
        "areaInSqMeters": 8290.0,
        "areaInHectares": 0.829,
        "landClassification": {
          "key": "rec-up-jaunpur-548-p1-class",
          "label": "Classification",
          "regionalLabel": "भूमि की श्रेणी (अधिकार)",
          "value": "श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)",
          "rawOcrValue": "श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)",
          "confidence": 0.98,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-p1-class",
            "x": 6.5,
            "y": 54.2,
            "width": 42.0,
            "height": 1.2,
            "label": "श्रेणी 1-क"
          },
          "isVerified": true
        },
        "annualRevenueLagaan": {
          "key": "rec-up-jaunpur-548-p1-tax",
          "label": "Revenue Cess",
          "regionalLabel": "वार्षिक लगान (मालगुजारी)",
          "value": "दोपांच दशमलव दो",
          "rawOcrValue": "दोपांच दशमलव दो",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-jaunpur-548-p1-tax",
            "x": 68.0,
            "y": 58.0,
            "width": 6.0,
            "height": 1.2,
            "label": "दोपांच दशमलव दो"
          },
          "isVerified": true
        },
        "boundingBox": {
          "id": "bb-rec-up-jaunpur-548-p1-row",
          "x": 50.0,
          "y": 58.0,
          "width": 17.0,
          "height": 1.2,
          "label": "खसरा 32 पंक्ति"
        },
        "chauhaddi": {
          "north": "गाटा 860 · सुरेश चौबे",
          "south": "गाटा 862 · रविन्द्र यादव",
          "east": "चकमार्ग (12 फीट रास्ता)",
          "west": "गाटा 859 · राजकीय नलकूप व नाली"
        },
        "hasRoadAccess": true
      }
    ],
    "discrepancies": [
      {
        "id": "rec-up-jaunpur-548-d1",
        "fieldKey": "totalStatedArea",
        "title": "🚨 बैंक बंधक दर्ज (1 ऋण)",
        "description": "सक्रिय बैंक बंधक: Baroda U.P Bank (₹ 237,000.00)। बैंक NOC आवश्यक।",
        "severity": "high",
        "suggestedAction": "बैंक नो-ड्यूज सर्टिफिकेट (NOC) प्राप्त करें।",
        "status": "PENDING_REVIEW"
      }
    ],
    "auditTrail": [
      {
        "id": "rec-up-jaunpur-548-audit-genesis",
        "timestamp": "2026-10-30 01:03 IST",
        "officerId": "REV_OFFICER_4829",
        "officerName": "R. K. Mishra",
        "officerDesignation": "Naib Tehsildar (Digitization Division)",
        "action": "ARCHIVAL_INGESTION_SEALED",
        "fieldLabel": "Automated Document Extraction",
        "oldValue": "Physical Scan Ingestion",
        "newValue": "Sealed with Bhu-Aadhaar ULPIN: UPDIS003200548",
        "integrityHash": "d5589a4f2d50acefbab69c8d182ef34488af95a6d900faa0be17504df5bf3893"
      },
      {
        "id": "audit-1793302540254",
        "timestamp": "2026-10-30 01:05 IST",
        "officerId": "REV_OFFICER_4829",
        "officerName": "Naib Tehsildar R. K. Mishra",
        "officerDesignation": "Naib Tehsildar (Pindra)",
        "action": "FIELD_EDITED",
        "fieldLabel": "Khata Number",
        "oldValue": "00548",
        "newValue": "00124-VERIFIED",
        "integrityHash": "238c2608e7f51de7751d7e50c8a4c86fb4c1dcb06522dc758a1c6c38a39b9631"
      },
      {
        "id": "audit-seal-1793302540263",
        "timestamp": "2026-10-30 01:05 IST",
        "officerId": "REV_OFFICER_4829",
        "officerName": "Naib Tehsildar R. K. Mishra",
        "officerDesignation": "Pindra Subdivision",
        "action": "FINAL_DIGITIZATION_SIGN_OFF",
        "fieldLabel": "Complete Record Dossier",
        "oldValue": "IN_REVIEW",
        "newValue": "Digitally Sealed with Bhu-Aadhaar ULPIN UPJAU003200548",
        "integrityHash": "fc21d0b8e23fb039af9b981bc14a28c3d8c5e2b8d1ed9c45663e6d7453c87ba7"
      }
    ]
  },
  {
    "id": "rec-up-861-193",
    "ulpin": "UPBAL086100858",
    "title": "उत्तर प्रदेश भूलेख खतौनी - ग्राम: चैनपुर गुलौरा (बलिया)",
    "state": "Uttar Pradesh",
    "stateCode": "UP",
    "district": "Ballia (बलिया)",
    "tehsil": "Belthara Road (बेल्थरा रोड)",
    "village": "चैनपुर गुलौरा (Chainpur Gulaura)",
    "lgdCode": "192831",
    "recordType": "Khasra-Khatauni",
    "primaryLanguage": "Hindi",
    "originalDocumentUrl": "/uploads/scan_ULPIN1793303110_20261030_011510_rendered.jpg",
    "scanCondition": "Standard Digital Scan",
    "estimatedYear": 2026,
    "khataNumber": {
      "key": "khataNumber",
      "label": "Khata Number",
      "regionalLabel": "खाता संख्या",
      "value": "00858",
      "rawOcrValue": "00858",
      "confidence": 0.99,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-861-193-khata",
        "x": 22.0,
        "y": 15.0,
        "width": 14.0,
        "height": 4.5,
        "label": "खाता 00858"
      },
      "isVerified": false
    },
    "fasliYear": {
      "key": "fasliYear",
      "label": "Fasli Assessment Year",
      "regionalLabel": "फसली वर्ष",
      "value": "1426 फसली -1431 (01 जुलाई, 2026 से 30",
      "rawOcrValue": "1426 फसली -1431 (01 जुलाई, 2026 से 30",
      "confidence": 0.96,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-861-193-fasli",
        "x": 74.0,
        "y": 15.0,
        "width": 18.0,
        "height": 4.5,
        "label": "1426 फसली -1431"
      },
      "isVerified": false
    },
    "totalStatedArea": {
      "key": "totalStatedArea",
      "label": "Total Stated Holding Area",
      "regionalLabel": "कुल दर्ज क्षेत्रफल",
      "value": "1.0000 हेक्टेयर (10,000 वर्ग मीटर · लगभग 79.1 बिस्वा)",
      "rawOcrValue": "1.0000 हे०",
      "confidence": 0.98,
      "confidenceTier": "high",
      "boundingBox": {
        "id": "bb-rec-up-861-193-area",
        "x": 65.0,
        "y": 62.0,
        "width": 28.0,
        "height": 5.5,
        "label": "कुल 1.0000 हे०"
      },
      "isVerified": false,
      "hasDiscrepancy": false
    },
    "totalStatedAreaInSqMeters": 10000.0,
    "boundaryGeoJson": null,
    "overallConfidence": 0.98,
    "verificationStatus": "IN_REVIEW",
    "isVerified": false,
    "approvedBy": null,
    "approvedAt": null,
    "owners": [
      {
        "id": "rec-up-861-193-o1",
        "name": {
          "key": "rec-up-861-193-o1-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "राजेश यादव",
          "rawOcrValue": "रा जेश या दव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o1-name",
            "x": 12.0,
            "y": 28.0,
            "width": 28.0,
            "height": 4.0,
            "label": "राजेश यादव"
          },
          "isVerified": false,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-861-193-o1-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "रामनक्षत्र यादव",
          "rawOcrValue": "रामनक्षत्र यादव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o1-rel",
            "x": 42.0,
            "y": 28.0,
            "width": 26.0,
            "height": 4.0,
            "label": "रामनक्षत्र यादव"
          },
          "isVerified": false
        },
        "shareFraction": {
          "key": "rec-up-861-193-o1-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "0.071000 हे० (समभाग)",
          "rawOcrValue": "0.071000 हे० (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o1-share",
            "x": 70.0,
            "y": 28.0,
            "width": 10.0,
            "height": 4.0,
            "label": "0.071000 हे० (समभाग)"
          },
          "isVerified": false
        },
        "individualHa": 0.25,
        "individualSqM": 2500.0,
        "individualBiswa": 19.77,
        "mobileNumber": null
      },
      {
        "id": "rec-up-861-193-o2",
        "name": {
          "key": "rec-up-861-193-o2-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "लाल बच्ची यादव",
          "rawOcrValue": "2) ला ल बच्ची या दव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o2-name",
            "x": 12.0,
            "y": 32.5,
            "width": 28.0,
            "height": 4.0,
            "label": "लाल बच्ची यादव"
          },
          "isVerified": false,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-861-193-o2-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "रामनक्षत्र यादव",
          "rawOcrValue": "रामनक्षत्र यादव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o2-rel",
            "x": 42.0,
            "y": 32.5,
            "width": 26.0,
            "height": 4.0,
            "label": "रामनक्षत्र यादव"
          },
          "isVerified": false
        },
        "shareFraction": {
          "key": "rec-up-861-193-o2-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "0.023700 हे० (समभाग)",
          "rawOcrValue": "0.023700 हे० (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o2-share",
            "x": 70.0,
            "y": 32.5,
            "width": 10.0,
            "height": 4.0,
            "label": "0.023700 हे० (समभाग)"
          },
          "isVerified": false
        },
        "individualHa": 0.25,
        "individualSqM": 2500.0,
        "individualBiswa": 19.77,
        "mobileNumber": null
      },
      {
        "id": "rec-up-861-193-o3",
        "name": {
          "key": "rec-up-861-193-o3-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "सुनील यादव",
          "rawOcrValue": "सुनी ल या दव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o3-name",
            "x": 12.0,
            "y": 37.0,
            "width": 28.0,
            "height": 4.0,
            "label": "सुनील यादव"
          },
          "isVerified": false,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-861-193-o3-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "रामनक्षत्र यादव",
          "rawOcrValue": "रामनक्षत्र यादव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o3-rel",
            "x": 42.0,
            "y": 37.0,
            "width": 26.0,
            "height": 4.0,
            "label": "रामनक्षत्र यादव"
          },
          "isVerified": false
        },
        "shareFraction": {
          "key": "rec-up-861-193-o3-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "0.023700 हे० (समभाग)",
          "rawOcrValue": "0.023700 हे० (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o3-share",
            "x": 70.0,
            "y": 37.0,
            "width": 10.0,
            "height": 4.0,
            "label": "0.023700 हे० (समभाग)"
          },
          "isVerified": false
        },
        "individualHa": 0.25,
        "individualSqM": 2500.0,
        "individualBiswa": 19.77,
        "mobileNumber": null
      },
      {
        "id": "rec-up-861-193-o4",
        "name": {
          "key": "rec-up-861-193-o4-name",
          "label": "Primary Tenure Holder",
          "regionalLabel": "खातेदार का नाम",
          "value": "रामनक्षत्र",
          "rawOcrValue": "रा मनक्षत्र",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o4-name",
            "x": 12.0,
            "y": 41.5,
            "width": 28.0,
            "height": 4.0,
            "label": "रामनक्षत्र"
          },
          "isVerified": false,
          "discrepancyNote": null
        },
        "relationType": "s/o",
        "relativeName": {
          "key": "rec-up-861-193-o4-rel",
          "label": "Father/Guardian Name",
          "regionalLabel": "पिता का नाम",
          "value": "बां सदेव",
          "rawOcrValue": "बां सदेव",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o4-rel",
            "x": 42.0,
            "y": 41.5,
            "width": 26.0,
            "height": 4.0,
            "label": "बां सदेव"
          },
          "isVerified": false
        },
        "shareFraction": {
          "key": "rec-up-861-193-o4-share",
          "label": "Holding Share",
          "regionalLabel": "अंश / भाग",
          "value": "0.023600 हे० (समभाग)",
          "rawOcrValue": "0.023600 हे० (समभाग)",
          "confidence": 0.99,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-o4-share",
            "x": 70.0,
            "y": 41.5,
            "width": 10.0,
            "height": 4.0,
            "label": "0.023600 हे० (समभाग)"
          },
          "isVerified": false
        },
        "individualHa": 0.25,
        "individualSqM": 2500.0,
        "individualBiswa": 19.77,
        "mobileNumber": null
      }
    ],
    "plots": [
      {
        "id": "rec-up-861-193-p1",
        "khasraNumber": {
          "key": "rec-up-861-193-p1-khasra",
          "label": "Gata / Khasra No.",
          "regionalLabel": "गाटा / खसरा संख्या",
          "value": "गाटा 861",
          "rawOcrValue": "861",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-p1-no",
            "x": 10.0,
            "y": 50.0,
            "width": 14.0,
            "height": 8.0,
            "label": "खसरा 861"
          },
          "isVerified": true
        },
        "regionalAreaText": {
          "key": "rec-up-861-193-p1-area",
          "label": "Plot Area",
          "regionalLabel": "क्षेत्रफल",
          "value": "1.0000 हे० (10,000 वर्ग मीटर)",
          "rawOcrValue": "1.0000 हे०",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-p1-area",
            "x": 26.0,
            "y": 50.0,
            "width": 22.0,
            "height": 8.0,
            "label": "1.0000 हे० (10,000 वर्ग मीटर)"
          },
          "isVerified": true
        },
        "areaInSqMeters": 10000.0,
        "areaInHectares": 1.0,
        "landClassification": {
          "key": "rec-up-861-193-p1-class",
          "label": "Classification",
          "regionalLabel": "भूमि की श्रेणी (अधिकार)",
          "value": "श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)",
          "rawOcrValue": "श्रेणी 1-क · संक्रमणीय भूमिधर (स्वयं की निजी भूमि — बिक्री व वसीयत का पूर्ण अधिकार)",
          "confidence": 0.98,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-p1-class",
            "x": 50.0,
            "y": 50.0,
            "width": 24.0,
            "height": 8.0,
            "label": "श्रेणी 1-क"
          },
          "isVerified": true
        },
        "annualRevenueLagaan": {
          "key": "rec-up-861-193-p1-tax",
          "label": "Revenue Cess",
          "regionalLabel": "वार्षिक लगान (मालगुजारी)",
          "value": "₹ 0.01",
          "rawOcrValue": "₹ 0.01",
          "confidence": 0.95,
          "confidenceTier": "high",
          "boundingBox": {
            "id": "bb-rec-up-861-193-p1-tax",
            "x": 76.0,
            "y": 50.0,
            "width": 14.0,
            "height": 8.0,
            "label": "₹ 0.01"
          },
          "isVerified": true
        },
        "boundingBox": {
          "id": "bb-rec-up-861-193-p1-row",
          "x": 10.0,
          "y": 50.0,
          "width": 84.0,
          "height": 8.0,
          "label": "खसरा 861 पंक्ति"
        },
        "chauhaddi": {
          "north": "गाटा 860 · सुरेश चौबे",
          "south": "गाटा 862 · रविन्द्र यादव",
          "east": "चकमार्ग (12 फीट रास्ता)",
          "west": "गाटा 859 · राजकीय नलकूप व नाली"
        },
        "hasRoadAccess": true
      }
    ],
    "discrepancies": [],
    "auditTrail": [
      {
        "id": "rec-up-861-193-audit-genesis",
        "timestamp": "2026-10-30 01:15 IST",
        "officerId": "REV_OFFICER_4829",
        "officerName": "R. K. Mishra",
        "officerDesignation": "Naib Tehsildar (Digitization Division)",
        "action": "ARCHIVAL_INGESTION_SEALED",
        "fieldLabel": "Automated Document Extraction",
        "oldValue": "Physical Scan Ingestion",
        "newValue": "Sealed with Bhu-Aadhaar ULPIN: UPBAL086100858",
        "integrityHash": "3828bd132fba619d9422056018a585cd2e5770b22bbcb0485d580d48d44260a5"
      }
    ]
  }
];
