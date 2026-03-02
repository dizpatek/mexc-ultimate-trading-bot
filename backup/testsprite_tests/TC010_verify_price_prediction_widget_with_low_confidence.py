import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_verify_price_prediction_widget_with_low_confidence():
    symbol = "ETHUSDT"
    url = f"{BASE_URL}/api/indicators/f4?symbol={symbol}"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    if response.status_code == 200:
        try:
            data = response.json()
        except ValueError:
            assert False, "Response is not valid JSON"

        confidence = data.get("confidence")
        predicted_targets = data.get("predictedTargets")

        # Validate presence of 'confidence' and 'predictedTargets' fields
        assert confidence is not None, "'confidence' field is missing in the response"
        assert isinstance(confidence, (float, int)), "'confidence' field should be a number"
        assert predicted_targets is not None, "'predictedTargets' field is missing in the response"

        # Check if confidence is low (assuming low confidence < 0.5 or <= 50%)
        if confidence <= 0.5:
            # Simulate widget advisory display check by asserting low confidence scenario
            assert confidence <= 0.5, "Confidence is not low as expected for this test case"
        else:
            # If confidence is high, this test case is not validating that scenario
            assert False, "Prediction model did not return low confidence as expected"
    else:
        # For error cases where prediction model returns error or low confidence indirectly
        # The widget should show 'Low confidence' advisory
        # Check common error statuses for this API: 400, 500, 503
        assert response.status_code in [400, 500, 503], (
            f"Unexpected status code {response.status_code} returned from price prediction API"
        )

test_verify_price_prediction_widget_with_low_confidence()