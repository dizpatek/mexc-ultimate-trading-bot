import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def verify_command_deck_kill_switch_enable_success():
    # Step 1: Enable the kill switch via POST to /api/command-deck
    url_post = f"{BASE_URL}/api/command-deck"
    payload = {"killSwitchEnabled": True}

    try:
        response_post = requests.post(url_post, json=payload, headers=HEADERS, timeout=TIMEOUT)
        # Validate response status code 200
        assert response_post.status_code == 200, f"Expected status 200 but got {response_post.status_code}"

        # Step 2: GET system state from /api/command-deck and verify killSwitchEnabled is True
        url_get_api = f"{BASE_URL}/api/command-deck"
        response_get_api = requests.get(url_get_api, headers=HEADERS, timeout=TIMEOUT)
        assert response_get_api.status_code == 200, f"Expected status 200 but got {response_get_api.status_code}"
        json_data_api = response_get_api.json()
        assert "killSwitchEnabled" in json_data_api, "'killSwitchEnabled' field missing in API response"
        assert json_data_api["killSwitchEnabled"] is True, "killSwitchEnabled is not True in API response"

        # Step 3: GET the UI /command-deck and check that the dashboard text contains 'Trading paused - Kill Switch ON'
        url_get_ui = f"{BASE_URL}/command-deck"
        response_get_ui = requests.get(url_get_ui, headers=HEADERS, timeout=TIMEOUT)
        assert response_get_ui.status_code == 200, f"Expected status 200 but got {response_get_ui.status_code}"
        dashboard_text = response_get_ui.text
        expected_text = "Trading paused - Kill Switch ON"
        assert expected_text in dashboard_text, f"Dashboard text does not contain expected message: '{expected_text}'"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


verify_command_deck_kill_switch_enable_success()