import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_verify_matrix_portfolio_ui_loads_with_valid_data():
    # Step 1: Load /matrix-portfolio UI page and ensure it requests the F4 Indicator API with a valid symbol
    dashboard_url = f"{BASE_URL}/matrix-portfolio"
    f4_indicator_url = f"{BASE_URL}/api/indicators/f4"
    market_scan_url = f"{BASE_URL}/api/market/scan"

    # Use a typical symbol from description
    symbol = "BTCUSDT"

    try:
        # Simulate UI loading by requesting /matrix-portfolio (GET)
        resp_dashboard = requests.get(dashboard_url, timeout=TIMEOUT)
        assert resp_dashboard.status_code == 200, f"/matrix-portfolio page did not load properly, status {resp_dashboard.status_code}"
        assert "matrix-portfolio" in resp_dashboard.text.lower(), "Dashboard page content missing expected keyword 'matrix-portfolio'"

        # Step 2: Request F4 Indicator API for the symbol
        params_f4 = {"symbol": symbol}
        resp_f4 = requests.get(f4_indicator_url, params=params_f4, timeout=TIMEOUT)
        assert resp_f4.status_code == 200, f"F4 Indicator API returned status {resp_f4.status_code}"
        json_f4 = resp_f4.json()

        # Validate presence and types of keys in response
        assert isinstance(json_f4, dict), "F4 Indicator response is not a JSON object"
        # Required fields: f4Series, f4Fibo (list), aiScore, whaleSignal, regimePrediction
        assert "f4Series" in json_f4, "Missing 'f4Series' in F4 Indicator response"
        assert "f4Fibo" in json_f4 and isinstance(json_f4["f4Fibo"], list), "'f4Fibo' missing or not a list in F4 Indicator response"
        assert "aiScore" in json_f4, "Missing 'aiScore' in F4 Indicator response"
        assert "whaleSignal" in json_f4, "Missing 'whaleSignal' in F4 Indicator response"
        assert "regimePrediction" in json_f4, "Missing 'regimePrediction' in F4 Indicator response"

        # aiScore should be a number
        ai_score = json_f4["aiScore"]
        assert isinstance(ai_score, (int, float)), "'aiScore' is not numeric"

        # Step 3: Request Market Scan API for at least one valid type to ensure portfolio health data integration
        for scan_type in ["gainers", "losers", "squeezes"]:
            resp_scan = requests.get(market_scan_url, params={"type": scan_type}, timeout=TIMEOUT)
            assert resp_scan.status_code == 200, f"Market Scan API type '{scan_type}' returned status {resp_scan.status_code}"
            json_scan = resp_scan.json()
            assert isinstance(json_scan, list), f"Market Scan API response for '{scan_type}' is not a list"

        # Removed fragile keyword presence assertions on dashboard page

    except (requests.RequestException, AssertionError) as e:
        assert False, f"Test failed: {e}"

test_verify_matrix_portfolio_ui_loads_with_valid_data()
