import requests
from requests.exceptions import RequestException, HTTPError, ConnectionError, Timeout

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def test_verify_command_deck_kill_switch_enable_failure():
    # First, get the current system state from GET /api/command-deck
    try:
        resp_get = requests.get(f"{BASE_URL}/api/command-deck", timeout=TIMEOUT)
        resp_get.raise_for_status()
        current_state = resp_get.json()
    except (RequestException, ValueError) as e:
        assert False, f"Failed to get current command deck state: {e}"

    original_kill_switch_enabled = current_state.get("killSwitchEnabled", None)
    original_system_state = current_state.get("systemState", None)

    # Attempt to enable kill switch by POSTing killSwitchEnabled=True
    url_post = f"{BASE_URL}/api/command-deck"
    payload = {"killSwitchEnabled": True}
    headers = {"Content-Type": "application/json"}

    error_occurred = False
    status_code = None
    try:
        resp_post = requests.post(url_post, json=payload, headers=headers, timeout=TIMEOUT)
        status_code = resp_post.status_code
        # Expecting failure: either 403 Forbidden or network error simulated by exception
        if status_code == 403:
            error_occurred = True
        else:
            # If backend returns 2xx or other code, treat as failure of test expectations
            assert False, f"Expected 403 status code or network error but got {status_code}"
    except (ConnectionError, Timeout):
        # Network errors are also expected failure modes
        error_occurred = True
    except HTTPError:
        error_occurred = True
    except RequestException as e:
        # Other request exceptions also count as error
        error_occurred = True

    assert error_occurred, "Expected failure (403 or network error) did not occur"

    # Verify that the system state remains unchanged (killSwitchEnabled and systemState)
    try:
        resp_get_after = requests.get(f"{BASE_URL}/api/command-deck", timeout=TIMEOUT)
        resp_get_after.raise_for_status()
        state_after = resp_get_after.json()
    except (RequestException, ValueError) as e:
        assert False, f"Failed to get command deck state after failed enable attempt: {e}"

    assert state_after.get("killSwitchEnabled", None) == original_kill_switch_enabled, (
        "Kill switch enabled state changed despite failure"
    )
    assert state_after.get("systemState", None) == original_system_state, (
        "System state changed despite failure"
    )

    # Since we test backend only, simulate UI message verification by checking error response or exception
    # UI message 'Failed to change system state' message would be displayed on frontend based on failure

test_verify_command_deck_kill_switch_enable_failure()