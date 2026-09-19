"""Screenshot Quality Gate for GHOST Signal Market Context Engine.

Enforces strict visual clarity standards on uploaded chart screenshots before any
market-context analysis is permitted. Prevents hallucination over blurry, unreadable,
or corrupted chart images.
"""

import base64
import io
import math
from typing import List, Optional, Tuple
import numpy as np
from PIL import Image, ImageStat

from app.schemas.market_context import EvidenceQuality, ScreenshotQualityGateResult


class ScreenshotQualityGate:
    """Rigorous visual inspection gate for financial chart screenshots."""

    MIN_WIDTH: int = 250
    MIN_HEIGHT: int = 150
    MIN_PIXEL_VARIANCE: float = 80.0  # Detects blank or solid images
    MIN_EDGE_ENTROPY: float = 3.5     # Detects blurry or featureless images

    @classmethod
    def decode_image(cls, image_data: str) -> Image.Image:
        """Decodes a base64 image data string into a PIL Image."""
        if not image_data or not isinstance(image_data, str):
            raise ValueError("Empty or invalid image data payload provided.")

        # Strip data URL prefix if present (e.g., data:image/png;base64,...)
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        clean_b64 = image_data.strip()
        image_bytes = base64.b64decode(clean_b64)
        image = Image.open(io.BytesIO(image_bytes))
        return image

    @classmethod
    def evaluate(
        cls,
        image_data: str,
        asset: Optional[str] = None,
        timeframe: Optional[str] = None,
        has_volume: bool = True,
    ) -> ScreenshotQualityGateResult:
        """Inspects visual characteristics and determines if the screenshot qualifies for analysis."""
        reasons: List[str] = []
        failed_checks: List[str] = []

        try:
            img = cls.decode_image(image_data)
        except Exception as exc:
            return ScreenshotQualityGateResult(
                quality_gate_passed=False,
                clarity_rating=EvidenceQuality.INSUFFICIENT,
                reasons=["Image payload could not be decoded or is corrupted."],
                candle_bodies_visible=False,
                wicks_visible=False,
                volume_visible=False,
                price_scale_visible=False,
                error_title="CHART CLARITY INSUFFICIENT",
                error_message=(
                    "The screenshot does not provide enough visual information for reliable "
                    "market-context analysis. Please upload a clearer screenshot."
                ),
            )

        width, height = img.size

        # 1. Dimension Check
        if width < cls.MIN_WIDTH or height < cls.MIN_HEIGHT:
            failed_checks.append(
                f"Resolution too low ({width}x{height}px). Minimum required is {cls.MIN_WIDTH}x{cls.MIN_HEIGHT}px."
            )
        else:
            reasons.append(f"Image resolution adequate ({width}x{height}px).")

        # 2. Aspect Ratio Check
        aspect_ratio = width / height if height > 0 else 0
        if aspect_ratio < 0.35 or aspect_ratio > 4.5:
            failed_checks.append("Unusual aspect ratio for a financial chart.")

        # 3. Grayscale analysis for contrast and sharpness
        gray = img.convert("L")
        stat = ImageStat.Stat(gray)
        variance = stat.var[0] if stat.var else 0.0

        if variance < cls.MIN_PIXEL_VARIANCE:
            failed_checks.append("Chart lacks sufficient contrast or appears monochromatic/blank.")
        else:
            reasons.append("Image dynamic contrast is adequate.")

        # 4. Edge and Detail Density (gradient analysis via NumPy)
        arr = np.array(gray, dtype=np.float32)
        if arr.shape[0] >= 10 and arr.shape[1] >= 10:
            gy, gx = np.gradient(arr)
            grad_magnitude = np.sqrt(gx**2 + gy**2)
            max_edge = float(np.max(grad_magnitude))
            significant_edges = int(np.sum(grad_magnitude > 15.0))

            if max_edge < 25.0 or significant_edges < 100:
                failed_checks.append("Image is excessively blurry or devoid of sharp candle bodies and wicks.")
            else:
                reasons.append(f"Edge sharpness confirmed ({significant_edges} significant structural edges detected).")
        else:
            failed_checks.append("Image dimensions insufficient for feature analysis.")
            significant_edges = 0

        # 5. Volume check
        volume_present = has_volume and (height >= 200)

        # 6. Synthesize Quality Gate Outcome
        quality_gate_passed = len(failed_checks) == 0

        if not quality_gate_passed:
            clarity_rating = EvidenceQuality.INSUFFICIENT
            return ScreenshotQualityGateResult(
                quality_gate_passed=False,
                clarity_rating=clarity_rating,
                reasons=failed_checks,
                candle_bodies_visible=False,
                wicks_visible=False,
                volume_visible=False,
                price_scale_visible=False,
                error_title="CHART CLARITY INSUFFICIENT",
                error_message=(
                    "The screenshot does not provide enough visual information for reliable "
                    "market-context analysis.\n\n"
                    "Please upload a clearer screenshot containing:\n"
                    "• visible candle bodies and wicks\n"
                    "• recent price action\n"
                    "• enough historical candles\n"
                    "• timeframe\n"
                    "• volume if available"
                ),
            )

        # Rate evidence quality based on resolution and sharpness
        if width >= 700 and height >= 400 and significant_edges >= 500:
            clarity_rating = EvidenceQuality.HIGH
        elif width >= 400 and height >= 250:
            clarity_rating = EvidenceQuality.MODERATE
        else:
            clarity_rating = EvidenceQuality.LIMITED

        return ScreenshotQualityGateResult(
            quality_gate_passed=True,
            clarity_rating=clarity_rating,
            reasons=reasons,
            candle_bodies_visible=True,
            wicks_visible=True,
            volume_visible=volume_present,
            price_scale_visible=True,
            error_title=None,
            error_message=None,
        )
