
#!/usr/bin/env python3
"""
Batch CloudFormation Stack Analyzer
Generated via Kiro CLI (kiro chat)
Updated to support cross-account role ARN

Reads stacks from stacks-to-analyze.txt and calls the diagnostics API for each.
Format: stack-name,region[,role_arn]  (role_arn is optional)
"""

import json
import os
import sys
import requests
from datetime import datetime

# Configuration
API_URL = os.environ.get(
    'CFN_DIAGNOSTICS_API_URL',
    'https://s979hd8i75.execute-api.us-east-1.amazonaws.com/prod/diagnose'
)
TIMEOUT = 130  # seconds (Lambda has 120s timeout)
REPORTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reports')
INPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stacks-to-analyze.txt')


def read_stacks_file(filepath):
    """Read stacks from input file. Format: stack-name,region[,role_arn]"""
    stacks = []
    if not os.path.exists(filepath):
        print(f"Error: Input file not found: {filepath}")
        sys.exit(1)

    with open(filepath, 'r') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue

            parts = line.split(',')
            if len(parts) < 2:
                print(f"Warning: Skipping malformed line {line_num}: {line}")
                continue

            stack_entry = {
                'stack_name': parts[0].strip(),
                'region': parts[1].strip(),
            }

            # Optional role_arn (third field)
            if len(parts) >= 3 and parts[2].strip():
                stack_entry['role_arn'] = parts[2].strip()

            stacks.append(stack_entry)

    return stacks


def analyze_stack(stack_entry):
    """Call the diagnostics API for a single stack."""
    payload = {
        'stack_name': stack_entry['stack_name'],
        'region': stack_entry['region'],
    }

    # Include role_arn if provided
    if 'role_arn' in stack_entry:
        payload['role_arn'] = stack_entry['role_arn']

    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers={'Content-Type': 'application/json'},
            timeout=TIMEOUT
        )

        if response.status_code == 200:
            return {'status': 'OK', 'data': response.json()}
        else:
            error_msg = response.text
            try:
                error_json = response.json()
                error_msg = error_json.get('error', response.text)
            except:
                pass
            return {'status': 'ERROR', 'error': f"HTTP {response.status_code}: {error_msg}"}

    except requests.exceptions.Timeout:
        return {'status': 'TIMEOUT', 'error': 'Request timed out (130s)'}
    except requests.exceptions.ConnectionError:
        return {'status': 'ERROR', 'error': 'Connection failed - is the API running?'}
    except Exception as e:
        return {'status': 'ERROR', 'error': str(e)}


def save_report(stack_name, result):
    """Save the analysis result to a JSON file."""
    os.makedirs(REPORTS_DIR, exist_ok=True)

    # Sanitize stack name for filename
    safe_name = stack_name.replace('/', '_').replace(':', '_')
    filename = f"{safe_name}.json"
    filepath = os.path.join(REPORTS_DIR, filename)

    with open(filepath, 'w') as f:
        json.dump(result, f, indent=2, default=str)

    return filepath


def print_summary(results):
    """Print a formatted summary table."""
    print("\n" + "=" * 100)
    print(f"{'Stack Name':<55} | {'Status':<8} | {'Failed':<6} | {'First Error'}")
    print("-" * 100)

    for r in results:
        stack_name = r['stack_name'][:54]
        status = r['result']['status']
        failed = 0
        first_error = 'N/A'

        if status == 'OK' and 'data' in r['result']:
            data = r['result']['data']
            failed = len(data.get('failed_resources', []))
            if failed > 0:
                first_error = data['failed_resources'][0].get('status_reason', 'Unknown')[:40]

        elif status in ('ERROR', 'TIMEOUT'):
            first_error = r['result'].get('error', 'Unknown')[:40]

        print(f"{stack_name:<55} | {status:<8} | {failed:<6} | {first_error}")

    print("=" * 100)


def main():
    print(f"CFN Stack Batch Analyzer")
    print(f"API: {API_URL}")
    print(f"Time: {datetime.now().isoformat()}")
    print()

    # Read input file
    stacks = read_stacks_file(INPUT_FILE)
    print(f"Analyzing {len(stacks)} stack(s)...\n")

    results = []
    for i, stack_entry in enumerate(stacks, 1):
        stack_name = stack_entry['stack_name']
        region = stack_entry['region']
        role_info = f" (via {stack_entry['role_arn'][:30]}...)" if 'role_arn' in stack_entry else ""

        print(f"[{i}/{len(stacks)}] Analyzing: {stack_name} ({region}){role_info}")

        result = analyze_stack(stack_entry)
        results.append({'stack_name': stack_name, 'region': region, 'result': result})

        # Save report
        if result['status'] == 'OK' and 'data' in result:
            filepath = save_report(stack_name, result['data'])
            print(f"         Report saved: {filepath}")
        else:
            print(f"         {result['status']}: {result.get('error', 'Unknown error')}")

    # Print summary
    print_summary(results)
    print(f"\nReports saved to: {REPORTS_DIR}")


if __name__ == '__main__':
    main()

