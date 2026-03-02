import requests

def verify_f4_indicator_api_with_valid_symbol():
    base_url = "http://localhost:3000"
    endpoint = "/api/indicators/f4"
    symbol = "BTCUSDT"
    url = f"{base_url}{endpoint}"
    params = {"symbol": symbol}
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate presence and types of required fields
    required_fields = ["f4Series", "f4Fibo", "aiScore", "whaleSignal", "regimePrediction"]
    for field in required_fields:
        assert field in data, f"Missing field '{field}' in response"

    # Validate f4Fibo is a list
    assert isinstance(data["f4Fibo"], list), f"Expected 'f4Fibo' to be a list, got {type(data['f4Fibo'])}"

    # Additional basic type checks for understanding
    assert isinstance(data["f4Series"], (list, dict)), f"Expected 'f4Series' to be list or dict, got {type(data['f4Series'])}"
    assert isinstance(data["aiScore"], (int, float)), f"Expected 'aiScore' to be int or float, got {type(data['aiScore'])}"
    assert isinstance(data["whaleSignal"], (str, dict, list, int, float, type(None))), "Unexpected type for 'whaleSignal'"
    assert data["regimePrediction"] is not None, "'regimePrediction' should not be None"

verify_f4_indicator_api_with_valid_symbol()