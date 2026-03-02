import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {
    "Accept": "application/json"
}

def test_verify_market_scan_api_with_valid_type():
    valid_types = ["gainers", "losers", "squeezes"]

    for scan_type in valid_types:
        try:
            response = requests.get(
                f"{BASE_URL}/api/market/scan",
                params={"type": scan_type},
                headers=HEADERS,
                timeout=TIMEOUT,
            )
        except requests.RequestException as e:
            assert False, f"Request to /api/market/scan with type={scan_type} raised an exception: {e}"

        assert response.status_code == 200, f"Expected status 200 but got {response.status_code} for type={scan_type}"

        try:
            data = response.json()
        except ValueError:
            assert False, f"Response is not valid JSON for type={scan_type}"

        assert isinstance(data, list), f"Expected response to be a list for type={scan_type}, got {type(data)}"

        # If list is not empty, check if each item is a dict and contains expected keys
        if data:
            for item in data:
                assert isinstance(item, dict), f"Market scan item is not an object for type={scan_type}"
                # Minimal validation of typical market scan fields:
                # We cannot know exact keys, but expect some keys like symbol, price, change or rank based on typical scans
                keys = item.keys()
                assert any(key in keys for key in ("symbol", "name", "price", "change", "rank")), (
                    f"Market scan item seems missing common fields for type={scan_type}"
                )

test_verify_market_scan_api_with_valid_type()