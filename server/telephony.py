import os
import re
import json
import requests
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, Form, Query
from fastapi.responses import Response

telephony_router = APIRouter(prefix="/api/telephony", tags=["Telephony"])

# ---------------------------------------------------------------------------
# 1. In-Memory Phone & Land Records Store
# ---------------------------------------------------------------------------

PARCEL_REGISTRY: Dict[str, Dict[str, Any]] = {
    "00124": {
        "id": "rec-up-mau-124",
        "khata": "00124",
        "state": "Uttar Pradesh",
        "district": "Gorakhpur (गोरखपुर)",
        "tehsil": "Chauri Chaura (चौरी-चौरा)",
        "village": "Mau (मऊ)",
        "fasliYear": "1430-1435",
        "totalHa": 0.0710,
        "totalBiswa": 5.61,
        "totalSqM": 710,
        "primaryOwner": "राजेश यादव",
        "owners": [
            {"name": "राजेश यादव", "relative": "रामनक्षत्र यादव", "share": "1/3"},
            {"name": "रामनक्षत्र यादव", "relative": "स्व. हरिराम यादव", "share": "1/3"},
            {"name": "लालबची यादव", "relative": "रामनक्षत्र यादव", "share": "1/3"}
        ],
        "plots": [{"khasra": "861", "areaHa": 0.0710}],
        "hasLoan": False,
        "loanDetails": "कोई बैंक बंधक दर्ज नहीं है (Clean Title)"
    },
    "00142": {
        "id": "rec-up-1431-varanasi",
        "khata": "00142",
        "state": "Uttar Pradesh",
        "district": "Varanasi (वाराणसी)",
        "tehsil": "Pindra (पिंडरा)",
        "village": "Rampur Kalan (रामपुर कलां)",
        "fasliYear": "1391 Fasli",
        "totalHa": 0.8600,
        "totalBiswa": 68.0,
        "totalSqM": 8600,
        "primaryOwner": "रामेश्वर प्रसाद चौबे",
        "owners": [
            {"name": "रामेश्वर प्रसाद चौबे", "relative": "स्व. बृजमोहन चौबे", "share": "1/2"},
            {"name": "देवेन्द्र नाथ चौबे", "relative": "स्व. बृजमोहन चौबे", "share": "1/2"}
        ],
        "plots": [{"khasra": "482/1", "areaHa": 0.4700}, {"khasra": "482/2", "areaHa": 0.3900}],
        "hasLoan": False,
        "loanDetails": "कोई बैंक बंधक दर्ज नहीं है"
    },
    "284": {
        "id": "rec-mh-712-pune",
        "khata": "284",
        "state": "Maharashtra",
        "district": "Pune (पुणे)",
        "tehsil": "Haveli (हवेली)",
        "village": "Ambegaon (आंबेगाव)",
        "fasliYear": "2001-2002",
        "totalHa": 0.4047,
        "totalBiswa": 32.0,
        "totalSqM": 4047,
        "primaryOwner": "संजय तुकाराम गायकवाड",
        "owners": [
            {"name": "संजय तुकाराम गायकवाड", "relative": "तुकाराम मारुतीराव गायकवाड", "share": "समभाग (1/1)"}
        ],
        "plots": [{"khasra": "109/2A", "areaHa": 0.1821}, {"khasra": "109/2B", "areaHa": 0.2226}],
        "hasLoan": False,
        "loanDetails": "भोगवटा वर्ग-१ (Zero Encumbrance)"
    }
}

# Mapping: Phone Number (normalized digits) -> Khata Number
PHONE_TO_KHATA: Dict[str, str] = {
    "9876543210": "00124",
    "+919876543210": "00124",
    "9811122233": "00142",
    "+919811122233": "00142"
}

def normalize_phone(phone: str) -> str:
    """Strips country code and special chars to match last 10 digits."""
    digits = re.sub(r"\D", "", phone or "")
    return digits[-10:] if len(digits) >= 10 else digits

def lookup_parcel_by_khata(khata_input: str) -> Optional[Dict[str, Any]]:
    clean = str(khata_input or "").strip().lstrip("0")
    for k, v in PARCEL_REGISTRY.items():
        if k.lstrip("0") == clean or k == khata_input.strip():
            return v
    return None

def lookup_parcel_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    norm = normalize_phone(phone)
    for p, khata in PHONE_TO_KHATA.items():
        if normalize_phone(p) == norm:
            return lookup_parcel_by_khata(khata)
    return None

def register_phone_link(phone: str, khata: str) -> bool:
    norm = normalize_phone(phone)
    if norm and khata:
        PHONE_TO_KHATA[norm] = khata
        PHONE_TO_KHATA[f"+91{norm}"] = khata
        return True
    return False

# ---------------------------------------------------------------------------
# 2. VoiceXML / TwiML Builder (Compatible with Twilio & Exotel Passthru)
# ---------------------------------------------------------------------------

def build_voicexml(
    speech_text: str,
    gather_action: Optional[str] = None,
    num_digits: Optional[int] = None,
    finish_on_key: Optional[str] = None,
    timeout: int = 6,
    input_type: str = "dtmf speech"
) -> str:
    """
    Generates standard VoiceXML / TwiML response with Indian Hindi voice.
    """
    clean_speech = speech_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    
    if gather_action:
        attrs = [f'action="{gather_action}"', f'method="POST"', f'timeout="{timeout}"', f'input="{input_type}"']
        if num_digits:
            attrs.append(f'numDigits="{num_digits}"')
        if finish_on_key:
            attrs.append(f'finishOnKey="{finish_on_key}"')
        
        attr_str = " ".join(attrs)
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather {attr_str}>
        <Say language="hi-IN" voice="Polly.Aditi">{clean_speech}</Say>
    </Gather>
    <Say language="hi-IN" voice="Polly.Aditi">कोई इनपुट प्राप्त नहीं हुआ। जानकारी के लिए पुनः कॉल करें। धन्यवाद।</Say>
    <Hangup/>
</Response>"""
    else:
        xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say language="hi-IN" voice="Polly.Aditi">{clean_speech}</Say>
    <Hangup/>
</Response>"""

    return xml

def xml_response(xml_string: str) -> Response:
    return Response(content=xml_string, media_type="application/xml")

# ---------------------------------------------------------------------------
# 3. Ultra-Fast Groq / Fallback AI Voice Resolver
# ---------------------------------------------------------------------------

def resolve_voice_question(question: str, record: Dict[str, Any]) -> str:
    """
    Resolves conversational voice questions:
    1. Checks if Groq API key is present for sub-300ms LPU streaming.
    2. Falls back to local Python revenue math engine (< 5ms).
    """
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key and groq_key != "your_groq_key_here":
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            system_prompt = (
                "You are Bhoo-Mitra AI, a respectful Indian Land Records phone helpline assistant. "
                "The caller is listening through a basic telephone earpiece. "
                "Rules:\n"
                "1. Answer in simple, polite spoken Hindi.\n"
                "2. Keep response to 2 short sentences maximum.\n"
                "3. Do NOT use bullet points, asterisks, English jargon, or markdown.\n"
                "4. Be authoritative and reassuring about their land rights."
            )
            user_content = (
                f"Land Record Context:\n"
                f"- Khata: {record['khata']}\n"
                f"- Village: {record['village']}, District: {record['district']}\n"
                f"- Owners: {', '.join([o['name'] for o in record['owners']])}\n"
                f"- Total Area: {record['totalHa']} Hectare ({record['totalBiswa']} Biswa)\n"
                f"- Bank Mortgage: {'Yes' if record['hasLoan'] else 'Zero loan, clean title'}\n\n"
                f"Caller's Question: {question}"
            )
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.2,
                "max_tokens": 120
            }
            res = requests.post(url, headers=headers, json=payload, timeout=2.5)
            if res.status_code == 200:
                answer = res.json()["choices"][0]["message"]["content"].strip()
                # Clean any stray formatting
                return answer.replace("*", "").replace("#", "")
        except Exception as e:
            print(f"[Warning] Groq Voice call failed: {e}. Using deterministic engine.")

    # High-precision deterministic revenue engine (< 5ms)
    from assistant_engine import calculate_python_assistant_answer
    adapted_context = {
        "khataNumber": {"value": record["khata"]},
        "village": record["village"],
        "plots": [{"areaInHectares": record["totalHa"], "khasraNumber": {"value": record["plots"][0]["khasra"]}}],
        "owners": [{"name": {"value": o["name"]}, "relativeName": {"value": o["relative"]}, "shareFraction": {"value": o["share"]}} for o in record["owners"]],
        "discrepancies": [{"title": "Bank Loan"}] if record["hasLoan"] else []
    }
    ans = calculate_python_assistant_answer(question, adapted_context, lang="hi")
    return ans.get("spoken_text", "आपका रिकॉर्ड सुरक्षित है।")

# ---------------------------------------------------------------------------
# 4. Telephony Endpoints (Dual Exotel & Twilio Compatible)
# ---------------------------------------------------------------------------

@telephony_router.api_route("/incoming", methods=["GET", "POST"])
async def handle_incoming_call(
    request: Request,
    From: Optional[str] = Form(None),
    CallFrom: Optional[str] = Query(None),
    Caller: Optional[str] = Form(None)
):
    """
    Answers incoming calls.
    - If caller's phone number is recognized: Welcome by name & give menu.
    - If caller is unknown (first-time): Prompt to dial 3-4 digit Khata number on keypad.
    """
    form_data = await request.form() if request.method == "POST" else {}
    caller_phone = From or CallFrom or Caller or form_data.get("From") or form_data.get("CallFrom") or ""
    
    parcel = lookup_parcel_by_phone(caller_phone)
    
    if parcel:
        # Recognized linked citizen
        primary_owner = parcel["primaryOwner"]
        village = parcel["village"]
        khata = parcel["khata"]
        greeting = (
            f"नमस्ते {primary_owner} जी! भू-लेखा किसान सेवा में आपका स्वागत है। "
            f"आपके नंबर से ग्राम {village}, खाता संख्या {khata} जुड़ा हुआ है। "
            f"अपने हिस्से की ज़मीन जानने के लिए 1 दबाएं। "
            f"बैंक लोन और बंधक की जानकारी के लिए 2 दबाएं। "
            f"सभी खातेदारों के नाम सुनने के लिए 3 दबाएं। "
            f"या अपना सवाल सीधे बोलें।"
        )
        xml = build_voicexml(
            greeting,
            gather_action=f"/api/telephony/action?khata={khata}&phone={caller_phone}",
            num_digits=1,
            timeout=8,
            input_type="dtmf speech"
        )
    else:
        # Unrecognized first-time caller
        prompt = (
            "भू-लेखा किसान हेल्पलाइन में आपका स्वागत है। "
            "कृपया अपने फोन के कीपैड से अपना 3 या 4 अंकों का खतौनी खाता संख्या दबाएं, "
            "और अंत में हैश दबाएं।"
        )
        xml = build_voicexml(
            prompt,
            gather_action=f"/api/telephony/process-khata?phone={caller_phone}",
            finish_on_key="#",
            timeout=10,
            input_type="dtmf speech"
        )
        
    return xml_response(xml)

@telephony_router.api_route("/process-khata", methods=["GET", "POST"])
async def process_khata_number(
    request: Request,
    phone: Optional[str] = Query(None),
    Digits: Optional[str] = Form(None),
    SpeechResult: Optional[str] = Form(None)
):
    """
    Processes the Khata number entered via keypad DTMF or spoken by the caller.
    """
    form_data = await request.form() if request.method == "POST" else {}
    entered_digits = Digits or form_data.get("Digits") or SpeechResult or form_data.get("SpeechResult") or ""
    
    # Extract numeric digits
    numbers_only = re.sub(r"\D", "", str(entered_digits))
    if not numbers_only:
        xml = build_voicexml(
            "माफ़ कीजिए, खाता संख्या समझ नहीं आई। कृपया फोन कीपैड से 3 या 4 अंकों का खाता नंबर दबाएं और अंत में हैश दबाएं।",
            gather_action=f"/api/telephony/process-khata?phone={phone or ''}",
            finish_on_key="#",
            timeout=8
        )
        return xml_response(xml)
        
    parcel = lookup_parcel_by_khata(numbers_only)
    if not parcel:
        # Retry prompt
        xml = build_voicexml(
            f"माफ़ कीजिए, खाता संख्या {numbers_only} का कोई रिकॉर्ड नहीं मिला। कृपया अपना सही खाता नंबर पुनः दबाएं।",
            gather_action=f"/api/telephony/process-khata?phone={phone or ''}",
            finish_on_key="#",
            timeout=8
        )
        return xml_response(xml)

    # Found parcel! Confirm identity with caller
    owners_str = " और ".join([o["name"] for o in parcel["owners"][:2]])
    confirm_text = (
        f"ग्राम {parcel['village']}, खाता संख्या {numbers_only} मिल गया है। "
        f"खातेदार {owners_str} हैं। "
        f"यदि यह आपका खाता है तो पुष्टि के लिए 1 दबाएं। दोबारा खाता संख्या डालने के लिए 2 दबाएं।"
    )
    xml = build_voicexml(
        confirm_text,
        gather_action=f"/api/telephony/confirm-khata?khata={parcel['khata']}&phone={phone or ''}",
        num_digits=1,
        timeout=8
    )
    return xml_response(xml)

@telephony_router.api_route("/confirm-khata", methods=["GET", "POST"])
async def confirm_khata(
    request: Request,
    khata: str = Query(...),
    phone: Optional[str] = Query(None),
    Digits: Optional[str] = Form(None)
):
    """
    Confirms parcel and auto-links caller's phone number for future instant recognition.
    """
    form_data = await request.form() if request.method == "POST" else {}
    selection = Digits or form_data.get("Digits") or "1"
    
    if selection == "1":
        # Auto-link phone number for future calls!
        if phone:
            register_phone_link(phone, khata)
            
        parcel = lookup_parcel_by_khata(khata)
        menu_text = (
            f"धन्यवाद! आपका खाता सफलतापूर्वक लोड हो गया है और आपका फोन नंबर लिंक कर दिया गया है। "
            f"अब से जब भी आप कॉल करेंगे, आपका खाता तुरंत खुल जाएगा। "
            f"अपने हिस्से की ज़मीन जानने के लिए 1 दबाएं। "
            f"बैंक लोन की जानकारी के लिए 2 दबाएं। "
            f"सभी खातेदारों के नाम सुनने के लिए 3 दबाएं। "
            f"या सीधे अपना सवाल बोलें।"
        )
        xml = build_voicexml(
            menu_text,
            gather_action=f"/api/telephony/action?khata={khata}&phone={phone or ''}",
            num_digits=1,
            timeout=8,
            input_type="dtmf speech"
        )
    else:
        # User wants to re-enter
        xml = build_voicexml(
            "कृपया अपना सही खतौनी खाता संख्या दबाएं और अंत में हैश दबाएं।",
            gather_action=f"/api/telephony/process-khata?phone={phone or ''}",
            finish_on_key="#",
            timeout=8
        )
    return xml_response(xml)

@telephony_router.api_route("/action", methods=["GET", "POST"])
async def handle_call_action(
    request: Request,
    khata: str = Query(...),
    phone: Optional[str] = Query(None),
    Digits: Optional[str] = Form(None),
    SpeechResult: Optional[str] = Form(None)
):
    """
    Executes farmer's selected action (1 = Share Math, 2 = Bank Loans, 3 = Owners, 4/Speech = Open AI question).
    """
    form_data = await request.form() if request.method == "POST" else {}
    selection = Digits or form_data.get("Digits") or ""
    spoken_query = SpeechResult or form_data.get("SpeechResult") or ""
    
    parcel = lookup_parcel_by_khata(khata)
    if not parcel:
        xml = build_voicexml("खाता विवरण प्राप्त नहीं हो सका। कॉल समाप्त की जा रही है।")
        return xml_response(xml)
        
    owner_count = len(parcel["owners"]) or 1
    share_biswa = round(parcel["totalBiswa"] / owner_count, 2)
    share_sq_m = round(parcel["totalSqM"] / owner_count)
    
    if selection == "1":
        # 1. Share proportion math
        response_text = (
            f"इस ज़मीन पर कुल {owner_count} सह-खातेदारों का बराबर हिस्सा है। "
            f"प्रत्येक खातेदार के हिस्से में लगभग {share_biswa} बिस्वा यानी {share_sq_m} वर्ग मीटर ज़मीन आती है। "
            f"अन्य सवाल के लिए 1 दबाएं, या फोन काट दें।"
        )
    elif selection == "2":
        # 2. Bank loan
        if parcel["hasLoan"]:
            response_text = "सावधानी: इस ज़मीन पर बैंक बंधक दर्ज है। ज़मीन के हस्तांतरण से पूर्व बैंक से एनओसी लेना अनिवार्य है। अन्य सवाल के लिए 1 दबाएं।"
        else:
            response_text = "यह ज़मीन पूर्णतः सुरक्षित है। सरकारी रिकॉर्ड के अनुसार इस पर कोई बैंक ऋण या अदालती रोक दर्ज नहीं है। अन्य सवाल के लिए 1 दबाएं।"
    elif selection == "3":
        # 3. Owners list
        names = ", ".join([f"{o['name']} (पिता {o['relative']})" for o in parcel["owners"]])
        response_text = f"सरकारी रिकॉर्ड में दर्ज खातेदार हैं: {names}। कुल रकबा {parcel['totalHa']} हेक्टेयर है। अन्य सवाल के लिए 1 दबाएं।"
    else:
        # Open-ended speech question or key 4
        query = spoken_query or "कुल कितनी जमीन है और क्या अधिकार हैं?"
        answer = resolve_voice_question(query, parcel)
        response_text = f"{answer} अन्य सवाल के लिए 1 दबाएं, या फोन काट दें।"
        
    xml = build_voicexml(
        response_text,
        gather_action=f"/api/telephony/incoming?From={phone or ''}",
        num_digits=1,
        timeout=6
    )
    return xml_response(xml)

# ---------------------------------------------------------------------------
# 5. Diagnostic / Simulator Endpoint (For Instant Zero-Cost Testing)
# ---------------------------------------------------------------------------

@telephony_router.post("/test-call")
async def simulate_call_step(
    step: str = "incoming",
    phone: str = "9876543210",
    digits: Optional[str] = None,
    speech: Optional[str] = None,
    khata: Optional[str] = None
):
    """
    Enables developer to simulate the entire phone call journey via JSON API
    without making real phone calls or paying telecom charges.
    """
    if step == "incoming":
        parcel = lookup_parcel_by_phone(phone)
        if parcel:
            return {
                "step": "welcome_linked_citizen",
                "phone": phone,
                "is_linked": True,
                "matched_parcel": parcel["khata"],
                "spoken_hindi": f"नमस्ते {parcel['primaryOwner']} जी! भू-लेखा किसान सेवा में आपका स्वागत है। आपके नंबर से ग्राम {parcel['village']}, खाता संख्या {parcel['khata']} जुड़ा हुआ है।",
                "menu_options": {
                    "1": "अपने हिस्से की ज़मीन जानें",
                    "2": "बैंक लोन और बंधक की जानकारी",
                    "3": "सभी खातेदारों के नाम",
                    "4": "खुला सवाल पूछें"
                }
            }
        else:
            return {
                "step": "unlinked_first_time_caller",
                "phone": phone,
                "is_linked": False,
                "spoken_hindi": "भू-लेखा किसान हेल्पलाइन में आपका स्वागत है। कृपया फोन कीपैड से 3 या 4 अंकों का खाता नंबर दबाएं और अंत में # दबाएं।"
            }
            
    elif step == "enter_khata":
        parcel = lookup_parcel_by_khata(digits or "00124")
        if parcel:
            return {
                "step": "confirm_khata",
                "khata": parcel["khata"],
                "village": parcel["village"],
                "owners": [o["name"] for o in parcel["owners"]],
                "spoken_hindi": f"ग्राम {parcel['village']}, खाता संख्या {parcel['khata']} मिल गया है। पुष्टि के लिए 1 दबाएं।"
            }
        return {"step": "khata_not_found", "error": f"खाता संख्या {digits} नहीं मिला।"}
        
    elif step == "confirm_and_link":
        register_phone_link(phone, khata or "00124")
        return {
            "step": "linked_successfully",
            "phone": phone,
            "linked_khata": khata or "00124",
            "spoken_hindi": "धन्यवाद! आपका फोन नंबर इस खाते से सुरक्षित लिंक कर दिया गया है।"
        }
        
    elif step == "action":
        parcel = lookup_parcel_by_khata(khata or "00124")
        if digits == "1":
            owner_count = len(parcel["owners"])
            share_biswa = round(parcel["totalBiswa"] / owner_count, 2)
            share_sq_m = round(parcel["totalSqM"] / owner_count)
            return {
                "step": "share_math_result",
                "spoken_hindi": f"इस ज़मीन पर कुल {owner_count} सह-खातेदारों का बराबर हिस्सा है। प्रत्येक खातेदार के हिस्से में लगभग {share_biswa} बिस्वा यानी {share_sq_m} वर्ग मीटर ज़मीन आती है।"
            }
        elif digits == "2":
            return {
                "step": "bank_loan_result",
                "spoken_hindi": "यह ज़मीन पूर्णतः सुरक्षित है। सरकारी रिकॉर्ड के अनुसार इस पर कोई बैंक ऋण या अदालती रोक दर्ज नहीं है।"
            }
        else:
            ans = resolve_voice_question(speech or "क्या जमीन बिक सकती है?", parcel)
            return {
                "step": "open_question_result",
                "query": speech or "क्या जमीन बिक सकती है?",
                "spoken_hindi": ans
            }
            
    return {"error": "Invalid step"}
