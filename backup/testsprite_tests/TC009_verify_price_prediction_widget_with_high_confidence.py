import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_verify_price_prediction_widget_with_high_confidence():
    symbol = "ETHUSDT"
    url = f"{BASE_URL}/api/indicators/f4"
    params = {"symbol": symbol}
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response content is not valid JSON"

    # Validate presence and types of predictedTargets and confidence fields
    assert "predictedTargets" in json_data, "Response missing 'predictedTargets'"
    assert "confidence" in json_data, "Response missing 'confidence'"

    predicted_targets = json_data["predictedTargets"]
    confidence = json_data["confidence"]

    # predictedTargets should be list or dict with numeric entries if not empty
    assert isinstance(predicted_targets, (list, dict)), "'predictedTargets' is not list or dict"
    if isinstance(predicted_targets, list):
        for target in predicted_targets:
            assert isinstance(target, (int, float)), "Each target in 'predictedTargets' should be numeric"
    else:
        # dict case: check values numeric
        for k, target in predicted_targets.items():
            assert isinstance(target, (int, float)), f"Target value for key '{k}' should be numeric"

    # confidence should be numeric and reasonably between 0 and 100 (percent)
    assert isinstance(confidence, (int, float)), "'confidence' is not numeric"
    assert 0 <= confidence <= 100, "'confidence' value out of expected range 0-100"

test_verify_price_prediction_widget_with_high_confidence()