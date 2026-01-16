# AGENTS.md - Python Project

## Build Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run
python main.py

# Run tests
pytest
pytest tests/ -v
pytest --tb=short
```

## Code Style Guidelines

### Imports
```python
# ✅ Correct - Organize imports
import os
import sys
from typing import List, Dict, Optional

import requests
from dotenv import load_dotenv
```

### Type Hints
```python
# ✅ Correct - Use type hints
def process_data(items: List[Dict[str, str]]) -> Optional[Dict]:
    """Process a list of items and return result."""
    if not items:
        return None
    return {"count": len(items)}
```

### Naming Conventions
```python
# Variables: snake_case
user_name = 'john'
is_active = True

# Constants: UPPER_SNAKE_CASE
MAX_RETRY_COUNT = 3
API_TIMEOUT = 30

# Functions: snake_case
def fetch_user_data():
    pass

# Classes: PascalCase
class UserService:
    pass
```

### Error Handling
```python
# ✅ Correct - Proper exception handling
def fetch_data(url: str) -> dict:
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
        raise
```

### Async/Await (if using)
```python
import asyncio

async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()
```

## Project Structure

```
/src
  main.py            # Entry point
  /modules          # Python modules
  /utils            # Utility functions
/tests              # Test files
requirements.txt
```

## Environment Variables

```bash
# Add to .env file
API_KEY="your-api-key"
ENDPOINT_URL="https://api.example.com"
```
