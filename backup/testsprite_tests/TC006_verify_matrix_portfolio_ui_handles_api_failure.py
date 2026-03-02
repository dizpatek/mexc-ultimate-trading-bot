import requests
from requests.exceptions import RequestException, Timeout

BASE_URL = "http://localhost:3000"
TIMEOUT = 30

def test_verify_matrix_portfolio_ui_handles_api_failure():
    session = requests.Session()

    # We will simulate the F4 Indicator API failure by calling it directly and verifying it fails (500 or timeout)
    f4_indicator_url = f"{BASE_URL}/api/indicators/f4?symbol=BTCUSDT"
    matrix_portfolio_url = f"{BASE_URL}/matrix-portfolio"

    try:
        # Step 1: Check the F4 Indicator API returns 500 or times out
        f4_failed = False
        try:
            response = session.get(f4_indicator_url, timeout=TIMEOUT)
            if response.status_code == 500:
                f4_failed = True
        except Timeout:
            f4_failed = True
        except RequestException:
            f4_failed = True

        assert f4_failed, "F4 Indicator API did not fail as expected (500 error or timeout)."

        # Step 2: Load the /matrix-portfolio page (simulate UI loading the dashboard)
        # This endpoint simulates the front-end dashboard request
        resp_portfolio = session.get(matrix_portfolio_url, timeout=TIMEOUT)
        assert resp_portfolio.status_code == 200, f"/matrix-portfolio page did not load successfully, status: {resp_portfolio.status_code}"
        
        # Step 3: Validate the UI content in returned HTML/text includes 'Signal unavailable'
        page_content = resp_portfolio.text.lower()
        assert 'signal unavailable' in page_content, "'Signal unavailable' message not found in matrix-portfolio UI on F4 Indicator API failure."
        
        # Step 4: Validate it shows last-known snapshot or placeholder text/keywords.
        # We check common placeholders either by presence of typical keywords for snapshot or placeholders.
        # Example keywords to check presence: "last-known snapshot", "placeholder", "no data", or similar
        placeholders = ['last-known snapshot', 'placeholder', 'no data', 'unavailable', 'loading failed']
        assert any(word in page_content for word in placeholders), "No last-known snapshot or placeholder indication found in matrix-portfolio UI."

    finally:
        session.close()

test_verify_matrix_portfolio_ui_handles_api_failure()