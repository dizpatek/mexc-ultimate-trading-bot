import requests

def test_verify_market_scan_api_when_external_scanner_fails():
    base_url = "http://localhost:3000"
    endpoint = "/api/market/scan"
    params = {"type": "gainers"}  # type param chosen to trigger scan logic
    headers = {
        "Accept": "application/json"
    }
    timeout = 30

    try:
        response = requests.get(f"{base_url}{endpoint}", headers=headers, params=params, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request to market scan API failed with exception: {e}"

    # Validate that when external scanner fails or cache empty,
    # the endpoint returns HTTP 503 status code
    assert response.status_code == 503, f"Expected status 503, got {response.status_code}"

    # Response content should contain 'scanner unavailable' message (case insensitive)
    json_resp = {}
    try:
        json_resp = response.json()
    except ValueError:
        # If response is not JSON, fallback to text search
        resp_text = response.text.lower()
        assert 'scanner unavailable' in resp_text, "Response does not contain 'scanner unavailable' message"
    else:
        # Check message field or any string value containing the text
        message_found = False
        # Try common keys first
        for key in ('message', 'error', 'detail', 'msg'):
            if key in json_resp and isinstance(json_resp[key], str):
                if 'scanner unavailable' in json_resp[key].lower():
                    message_found = True
                    break
        # Otherwise check all string values in dict (shallow)
        if not message_found:
            for v in json_resp.values():
                if isinstance(v, str) and 'scanner unavailable' in v.lower():
                    message_found = True
                    break
        assert message_found, "Response JSON does not contain 'scanner unavailable' message"

test_verify_market_scan_api_when_external_scanner_fails()