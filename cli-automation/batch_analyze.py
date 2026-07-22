#!/usr/bin/env python3
"""Batch analyze CloudFormation stacks for failure diagnostics.

Reads stack names and regions from stacks-to-analyze.txt, calls the
diagnostics API for each, saves reports, and prints a summary table.
"""

import json
import os
import sys

import requests

API_URL = "https://s979hd8i75.execute-api.us-east-1.amazonaws.com/prod/diagnose"
TIMEOUT_SECONDS = 130
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, "stacks-to-analyze.txt")
REPORTS_DIR = os.path.join(SCRIPT_DIR, "reports")


def read_stacks(filepath):
    """Read stacks from the input file. Each line: stack-name,region"""
    stacks = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",", 1)
            if len(parts) != 2:
                print(f"WARNING: Skipping malformed line: {line}")
                continue
            stack_name, region = parts[0].strip(), parts[1].strip()
            stacks.append((stack_name, region))
    return stacks


def analyze_stack(stack_name, region):
    """Send a POST request to the diagnostics API and return the response."""
    payload = {"stack_name": stack_name, "region": region}
    try:
        response = requests.post(API_URL, json=payload, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()
        return {"success": True, "data": response.json()}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out (130s)"}
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Connection error"}
    except requests.exceptions.HTTPError as e:
        return {"success": False, "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON in response"}


def save_report(stack_name, result):
    """Save the API response to reports/{stack-name}.json"""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    report_path = os.path.join(REPORTS_DIR, f"{stack_name}.json")
    with open(report_path, "w") as f:
        json.dump(result, f, indent=2)
    return report_path


def count_failed_resources(data):
    """Count failed resources from the diagnostics response."""
    if isinstance(data, dict):
        # Try common response structures
        if "failed_resources" in data:
            resources = data["failed_resources"]
            return len(resources) if isinstance(resources, list) else 0
        if "body" in data:
            body = data["body"]
            if isinstance(body, str):
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    return 0
            if isinstance(body, dict) and "failed_resources" in body:
                return len(body["failed_resources"])
    return 0


def get_first_error(data):
    """Extract the first error message from the diagnostics response."""
    if isinstance(data, dict):
        # Try common response structures
        failed = None
        if "failed_resources" in data:
            failed = data["failed_resources"]
        elif "body" in data:
            body = data["body"]
            if isinstance(body, str):
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    return "N/A"
            if isinstance(body, dict) and "failed_resources" in body:
                failed = body["failed_resources"]

        if failed and isinstance(failed, list) and len(failed) > 0:
            first = failed[0]
            if isinstance(first, dict):
                return first.get("status_reason", first.get("error", "N/A"))[:80]
    return "N/A"


def print_summary(results):
    """Print a formatted summary table of all results."""
    # Column widths
    name_width = max(len("Stack Name"), max((len(r["name"]) for r in results), default=10))
    name_width = min(name_width, 55)  # Cap width for readability

    header = f"{'Stack Name':<{name_width}} | {'Status':<10} | {'Failed':<6} | First Error"
    separator = "-" * len(header)

    print("\n" + separator)
    print(header)
    print(separator)

    for r in results:
        name = r["name"][:name_width]
        status = r["status"]
        failed = r["failed_count"]
        error = r["first_error"][:60]
        print(f"{name:<{name_width}} | {status:<10} | {failed:<6} | {error}")

    print(separator + "\n")


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"ERROR: Input file not found: {INPUT_FILE}")
        sys.exit(1)

    stacks = read_stacks(INPUT_FILE)
    if not stacks:
        print("No stacks found in input file.")
        sys.exit(0)

    print(f"Analyzing {len(stacks)} stack(s)...\n")

    results = []

    for stack_name, region in stacks:
        print(f"  → Analyzing: {stack_name} ({region})...")
        result = analyze_stack(stack_name, region)

        if result["success"]:
            save_report(stack_name, result["data"])
            failed_count = count_failed_resources(result["data"])
            first_error = get_first_error(result["data"])
            results.append({
                "name": stack_name,
                "status": "OK",
                "failed_count": failed_count,
                "first_error": first_error,
            })
        else:
            save_report(stack_name, {"error": result["error"]})
            results.append({
                "name": stack_name,
                "status": "ERROR",
                "failed_count": "N/A",
                "first_error": result["error"][:60],
            })

    print_summary(results)
    print(f"Reports saved to: {REPORTS_DIR}")


if __name__ == "__main__":
    main()
