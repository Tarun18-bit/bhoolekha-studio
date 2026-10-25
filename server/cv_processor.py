import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

def bytes_to_cv2(image_bytes: bytes) -> np.ndarray:
    """Converts raw image bytes or PDF bytes to OpenCV BGR image array."""
    # Check for PDF magic header
    if image_bytes.startswith(b'%PDF') or b'%PDF-' in image_bytes[:32]:
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(image_bytes)
            if len(pdf) > 0:
                # Render multi-page PDFs (up to 5 pages) and stack vertically
                # so Gemini and the viewer see the complete document (header, owners, area, loans)
                pages_to_render = min(len(pdf), 5)
                page_imgs = []
                for p_idx in range(pages_to_render):
                    pil_img = pdf[p_idx].render(scale=1.6).to_pil()
                    page_imgs.append(np.array(pil_img))

                if len(page_imgs) == 1:
                    stacked = page_imgs[0]
                else:
                    max_w = max(img.shape[1] for img in page_imgs)
                    resized = []
                    for img in page_imgs:
                        if img.shape[1] != max_w:
                            new_h = int(img.shape[0] * (max_w / img.shape[1]))
                            resized.append(cv2.resize(img, (max_w, new_h)))
                        else:
                            resized.append(img)
                    stacked = np.vstack(resized)

                return cv2.cvtColor(stacked, cv2.COLOR_RGB2BGR)
        except Exception as e:
            print(f"[Warning] pypdfium2 failed: {e}")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        try:
            # Fallback to PIL if imdecode fails on certain formats (e.g. WebP, TIFF)
            pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Could not decode image or PDF data: {e}")
    return img

def cv2_to_base64(image: np.ndarray, ext: str = ".jpg") -> str:
    """Converts OpenCV image array to base64 data URI string."""
    _, buffer = cv2.imencode(ext, image, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    encoded = base64.b64encode(buffer).decode("utf-8")
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    return f"data:{mime};base64,{encoded}"

def estimate_skew_angle(image: np.ndarray) -> float:
    """
    Estimates document skew angle in degrees using edge detection and Hough Line Transform.
    Returns angle between -45 and 45 degrees.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    # Apply Gaussian blur & Canny edge detection
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    # Probabilistic Hough Transform
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=100, minLineLength=80, maxLineGap=10)

    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0:
            continue
        angle = np.degrees(np.arctan2(dy, dx))
        # Keep angles near horizontal text lines (-30 to +30 degrees)
        if -30.0 <= angle <= 30.0:
            angles.append(angle)

    if len(angles) == 0:
        return 0.0

    # Return median angle to reject outliers
    median_angle = float(np.median(angles))
    return round(median_angle, 2)

def deskew_image(image: np.ndarray, angle: float) -> np.ndarray:
    """
    Rotates an image by the given angle around center, maintaining borders.
    """
    if abs(angle) < 0.1:
        return image

    h, w = image.shape[:2]
    center = (w // 2, h // 2)

    rot_matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Calculate new bounding dimensions to prevent clipping
    cos_val = np.abs(rot_matrix[0, 0])
    sin_val = np.abs(rot_matrix[0, 1])
    new_w = int((h * sin_val) + (w * cos_val))
    new_h = int((h * cos_val) + (w * sin_val))

    rot_matrix[0, 2] += (new_w / 2) - center[0]
    rot_matrix[1, 2] += (new_h / 2) - center[1]

    # White border for scanned paper background
    deskewed = cv2.warpAffine(
        image, 
        rot_matrix, 
        (new_w, new_h), 
        flags=cv2.INTER_CUBIC, 
        borderMode=cv2.BORDER_CONSTANT, 
        borderValue=(245, 245, 245)
    )
    return deskewed

def enhance_contrast_clahe(image: np.ndarray) -> np.ndarray:
    """
    Applies Contrast Limited Adaptive Histogram Equalization (CLAHE)
    to boost faded cursive ink and degraded stamp marks.
    """
    if len(image.shape) == 3:
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        enhanced = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        return enhanced
    else:
        clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
        return clahe.apply(image)

def sauvola_binarize(image: np.ndarray, window_size: int = 25, k: float = 0.2, r: float = 128.0) -> np.ndarray:
    """
    Sauvola adaptive thresholding implementation for historical documents.
    T(x,y) = m(x,y) * (1 + k * (s(x,y) / R - 1))
    Effectively eliminates yellow background aging and ink bleed-through.
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    gray_float = gray.astype(np.float32)

    # Local mean
    mean = cv2.boxFilter(gray_float, cv2.CV_32F, (window_size, window_size))
    # Local square mean for variance
    sq_mean = cv2.boxFilter(gray_float ** 2, cv2.CV_32F, (window_size, window_size))
    
    # Local standard deviation
    variance = sq_mean - (mean ** 2)
    variance[variance < 0] = 0
    std = np.sqrt(variance)

    # Sauvola threshold formula
    threshold = mean * (1.0 + k * (std / r - 1.0))

    # Binary mask
    binary = np.zeros_like(gray, dtype=np.uint8)
    binary[gray_float > threshold] = 255

    # Denoise slight salt-and-pepper artifacts with median filter
    denoised = cv2.medianBlur(binary, 3)
    return denoised
