import requests

def verify_f4_indicator_api_with_invalid_symbol():
    base_url = "http://localhost:3000"
    endpoint = f"{base_url}/api/indicators/f4"
    invalid_symbol = "INVALIDSYMBOL123"

    params = {"symbol": invalid_symbol}
    headers = {
        "Accept": "application/json"
    }

    try:
        response = requests.get(endpoint, headers=headers, params=params, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"

    try:
        json_response = response.json()
    except ValueError:
        assert False, "Response is not a valid JSON"

    # Validate the presence of an error message indicating invalid symbol
    error_message = json_response.get("message") or json_response.get("error") or json_response.get("detail")
    assert error_message, "Error message not found in response"
    assert "invalid" in error_message.lower() or "symbol" in error_message.lower(), \
        f"Error message does not indicate invalid symbol: {error_message}"

verify_f4_indicator_api_with_invalid_symbol()