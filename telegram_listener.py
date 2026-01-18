"""
Telegram Signal Listener - Production Version
Monitors @signalscryptoglobal and sends signals to Next.js API
"""

import asyncio
import re
import os
from datetime import datetime
from typing import Optional, Dict, Any
import json

try:
    from telethon import TelegramClient, events
    import aiohttp
except ImportError:
    print("ERROR: Required packages not installed!")
    print("Please run: pip install telethon aiohttp")
    exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================
API_ID = os.getenv('TELEGRAM_API_ID', 'YOUR_API_ID')
API_HASH = os.getenv('TELEGRAM_API_HASH', 'YOUR_API_HASH')
PHONE = os.getenv('TELEGRAM_PHONE', 'YOUR_PHONE_NUMBER')

# Next.js API endpoint
NEXTJS_API_URL = os.getenv('NEXTJS_API_URL', 'http://localhost:3000/api/signals/telegram')

# Channel to monitor
CHANNEL = '@signalscryptoglobal'

# ============================================================================
# SIGNAL PARSER
# ============================================================================

def parse_signal(message_text: str) -> Dict[str, Any]:
    """Parse trading signal from Telegram message"""
    
    signal = {
        'timestamp': datetime.now().isoformat(),
        'raw_message': message_text,
        'symbol': None,
        'direction': 'LONG',
        'entry': None,
        'targets': [],
        'stop_loss': None,
        'exchange': 'MEXC',
        'pair_type': 'SPOT'
    }
    
    # Extract symbol
    symbol_match = re.search(r'\$([A-Z]{3,10})', message_text)
    if symbol_match:
        signal['symbol'] = symbol_match.group(1) + 'USDT'
    else:
        pair_match = re.search(r'([A-Z]{3,10})/USDT', message_text)
        if pair_match:
            signal['symbol'] = pair_match.group(1) + 'USDT'
    
    # Direction
    if re.search(r'\bSHORT\b', message_text, re.IGNORECASE):
        signal['direction'] = 'SHORT'
    
    # Entry price
    entry_match = re.search(r'Entry[:\s]+([0-9.]+)', message_text, re.IGNORECASE)
    if entry_match:
        signal['entry'] = float(entry_match.group(1))
    
    # Targets
    target_matches = re.findall(r'(?:Target|TP)[:\s]*([0-9.]+)', message_text, re.IGNORECASE)
    signal['targets'] = [float(t) for t in target_matches]
    
    # Stop loss
    stop_match = re.search(r'(?:Stop|SL)[:\s]+([0-9.]+)', message_text, re.IGNORECASE)
    if stop_match:
        signal['stop_loss'] = float(stop_match.group(1))
    
    # Pair type
    if re.search(r'\bFUTURES?\b', message_text, re.IGNORECASE):
        signal['pair_type'] = 'FUTURES'
    
    # Exchange
    if re.search(r'\bBINANCE\b', message_text, re.IGNORECASE):
        signal['exchange'] = 'BINANCE'
    
    return signal

def is_valid_signal(signal: Dict[str, Any]) -> bool:
    """Check if parsed signal has minimum required fields"""
    return (
        signal['symbol'] is not None and
        signal['entry'] is not None and
        len(signal['targets']) > 0
    )

# ============================================================================
# API CLIENT
# ============================================================================

async def send_signal_to_api(signal: Dict[str, Any]) -> bool:
    """Send signal to Next.js API"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(NEXTJS_API_URL, json=signal) as response:
                if response.status == 200:
                    result = await response.json()
                    return result.get('success', False)
                else:
                    print(f"API Error: {response.status}")
                    return False
    except Exception as e:
        print(f"Failed to send signal to API: {e}")
        return False

# ============================================================================
# TELEGRAM CLIENT
# ============================================================================

client = TelegramClient('signals_session', API_ID, API_HASH)

@client.on(events.NewMessage(chats=CHANNEL))
async def signal_handler(event):
    """Handle new messages from the signals channel"""
    
    message = event.message.message
    
    print(f"\n{'='*60}")
    print(f"NEW MESSAGE at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(message[:200] + ('...' if len(message) > 200 else ''))
    print(f"{'='*60}\n")
    
    # Parse the signal
    signal = parse_signal(message)
    
    if is_valid_signal(signal):
        print("✓ VALID SIGNAL DETECTED")
        print(f"  Symbol: {signal['symbol']}")
        print(f"  Entry: {signal['entry']}")
        print(f"  Targets: {signal['targets']}")
        print(f"  Stop Loss: {signal['stop_loss']}")
        
        # Send to Next.js API
        success = await send_signal_to_api(signal)
        if success:
            print("✓ Signal sent to API successfully")
        else:
            print("✗ Failed to send signal to API")
        
        # Also save to local file as backup
        with open('signals_log.json', 'a') as f:
            f.write(json.dumps(signal) + '\n')
    else:
        print("✗ Not a valid trading signal")

# ============================================================================
# MAIN
# ============================================================================

async def main():
    """Start the Telegram client and listen for signals"""
    
    print("="*60)
    print("Telegram Signal Listener - Production Mode")
    print("="*60)
    print(f"Monitoring channel: {CHANNEL}")
    print(f"API endpoint: {NEXTJS_API_URL}")
    print("="*60)
    
    await client.start(phone=PHONE)
    
    try:
        channel_entity = await client.get_entity(CHANNEL)
        print(f"✓ Connected to: {channel_entity.title}")
    except Exception as e:
        print(f"Warning: Could not get channel info: {e}")
    
    print("\n✓ Listening for signals... (Press Ctrl+C to stop)\n")
    
    await client.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\nStopping listener...")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
