"""
CloudFormation Stack Diagnostics Lambda Handler.
Reuses the logic from the original CLI script to walk nested stacks
and return structured JSON for the frontend.
"""

import json
import math
from datetime import datetime, timezone
from collections import defaultdict

import boto3
from botocore.exceptions import ClientError


def lambda_handler(event, context):
    """API Gateway Lambda handler."""
    try:
        # Parse request body
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        else:
            body = event.get("body", event)

        stack_name = body.get("stack_name")
        region = body.get("region")
        role_arn = body.get("role_arn")

        if not stack_name or not region:
            return response(400, {"message": "stack_name and region are required"})

        if not role_arn:
            return response(400, {"message": "role_arn is required for cross-account access"})

        # Validate role ARN format
        if not role_arn.startswith("arn:aws:iam::") or ":role/" not in role_arn:
            return response(400, {"message": "Invalid role ARN format"})

        # Assume the cross-account role
        try:
            cfn = get_cross_account_cfn_client(role_arn, region)
        except ClientError as e:
            error_msg = e.response["Error"]["Message"]
            return response(403, {
                "message": f"Failed to assume role: {error_msg}. "
                           f"Ensure the role trust policy allows this Lambda to assume it."
            })

        # Get stack info
        try:
            info = get_stack_info(cfn, stack_name)
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            error_msg = e.response["Error"]["Message"]
            return response(403, {
                "message": f"Access denied when reading stack ({error_code}): {error_msg}. "
                           f"Ensure the role has cloudformation:DescribeStacks permission."
            })

        if not info:
            # Debug: show which identity was assumed and what region was used
            try:
                sts_debug = get_cross_account_sts_client(role_arn, region)
                caller = sts_debug.get_caller_identity()
                caller_info = f"Assumed identity: {caller.get('Arn', 'unknown')} (Account: {caller.get('Account', 'unknown')})"
            except Exception:
                caller_info = "Could not determine assumed identity"

            return response(404, {
                "message": f"Stack '{stack_name}' not found in {region}. {caller_info}"
            })

        stack_arn = info.get("StackId", stack_name)
        stack_status = info["StackStatus"]

        # Get operation window
        root_events = get_all_events(cfn, stack_arn)
        if not root_events:
            return response(404, {"message": "No events found for root stack"})

        root_op = identify_latest_operation(root_events, stack_name)
        if not root_op:
            return response(404, {"message": "Could not identify operation window"})

        # Walk hierarchy
        all_timings, stack_summary = walk_and_analyze(
            cfn, stack_arn,
            root_op["start_time"], root_op["end_time"]
        )

        # Filter to real failures
        failed_resources = [
            r for r in all_timings
            if r["is_failed"] and not is_cancelled_failure(r["status_reason"])
        ]

        # Build tree
        tree = build_tree(stack_summary)

        # Format response
        op_duration = (root_op["end_time"] - root_op["start_time"]).total_seconds()

        result = {
            "stackName": stack_name,
            "region": region,
            "stackStatus": stack_status,
            "operation": {
                "startTime": root_op["start_time"].isoformat(),
                "endTime": root_op["end_time"].isoformat(),
                "operationType": root_op["operation_type"],
                "finalStatus": root_op["final_status"],
                "durationFormatted": format_duration(op_duration),
            },
            "stackSummary": [
                {
                    "stack": s["stack"],
                    "stackPath": s["stack_path"],
                    "depth": s["depth"],
                    "totalResources": s["total_resources"],
                    "failed": s["failed"],
                }
                for s in stack_summary
            ],
            "failedResources": [format_timing(r) for r in failed_resources],
            "allTimings": [format_timing(r) for r in all_timings],
            "tree": tree,
        }

        return response(200, result)

    except Exception as e:
        return response(500, {"message": f"Internal error: {str(e)}"})


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }


def get_cross_account_cfn_client(role_arn, region):
    """
    Assume a cross-account IAM role and return a CloudFormation client
    using the temporary credentials.
    """
    import os
    external_id = os.environ.get("EXTERNAL_ID", "cfn-diagnostics")

    sts = boto3.client("sts")
    assumed = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="cfn-diagnostics-session",
        ExternalId=external_id,
        DurationSeconds=900,  # 15 minutes (minimum)
    )
    creds = assumed["Credentials"]
    session = boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=region,
    )
    return session.client("cloudformation")


def get_cross_account_sts_client(role_arn, region):
    """
    Assume a cross-account IAM role and return an STS client for debugging.
    """
    import os
    external_id = os.environ.get("EXTERNAL_ID", "cfn-diagnostics")

    sts = boto3.client("sts")
    assumed = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName="cfn-diagnostics-debug",
        ExternalId=external_id,
        DurationSeconds=900,
    )
    creds = assumed["Credentials"]
    session = boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=region,
    )
    return session.client("sts")


def format_timing(r):
    return {
        "logicalId": r["logical_id"],
        "resourceType": r["resource_type"],
        "physicalId": r["physical_id"],
        "startTime": r["start_time"].isoformat() if r["start_time"] else None,
        "endTime": r["end_time"].isoformat() if r["end_time"] else None,
        "durationSeconds": r["duration_seconds"],
        "durationFormatted": format_duration(r["duration_seconds"]),
        "finalStatus": r["final_status"],
        "statusReason": r["status_reason"],
        "isFailed": r["is_failed"],
        "isNestedStack": r["is_nested_stack"],
        "depth": r["depth"],
        "stackPath": r["stack_path"],
    }


def build_tree(stack_summary):
    """Build a nested tree structure from flat stack summary."""
    if not stack_summary:
        return {"name": "Unknown", "stackPath": "", "depth": 0, "totalResources": 0, "failedCount": 0, "children": []}

    # Create nodes
    nodes = {}
    for s in stack_summary:
        nodes[s["stack_path"]] = {
            "name": s["stack"],
            "stackPath": s["stack_path"],
            "depth": s["depth"],
            "totalResources": s["total_resources"],
            "failedCount": s["failed"],
            "children": [],
        }

    # Build parent-child relationships
    root = None
    for path, node in nodes.items():
        if node["depth"] == 0:
            root = node
        else:
            parent_path = "/".join(path.split("/")[:-1])
            if parent_path in nodes:
                nodes[parent_path]["children"].append(node)

    return root or nodes[stack_summary[0]["stack_path"]]


# ============================================================
# Core Logic (from script.py, adapted for Lambda)
# ============================================================

def get_stack_short_name(stack_name_or_arn):
    if "/" in stack_name_or_arn:
        return stack_name_or_arn.split("/")[1]
    return stack_name_or_arn


def get_stack_info(cfn, stack_name):
    try:
        stacks = cfn.describe_stacks(StackName=stack_name)["Stacks"]
        if stacks:
            return stacks[0]
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        error_msg = e.response["Error"]["Message"]
        if "does not exist" in error_msg:
            try:
                for page in cfn.get_paginator("list_stacks").paginate(
                    StackStatusFilter=["DELETE_COMPLETE"]
                ):
                    for s in page["StackSummaries"]:
                        if s["StackName"] == stack_name:
                            try:
                                result = cfn.describe_stacks(StackName=s["StackId"])["Stacks"]
                                if result:
                                    return result[0]
                            except ClientError:
                                pass
            except ClientError:
                pass
        else:
            # Re-raise access denied or other unexpected errors
            # so the caller can surface them properly
            raise
    return None


def get_all_events(cfn, stack_name):
    events = []
    try:
        for page in cfn.get_paginator("describe_stack_events").paginate(StackName=stack_name):
            events.extend(page["StackEvents"])
    except ClientError:
        return []
    return events


def get_nested_stacks_from_events(events, stack_name):
    nested = {}
    short_name = get_stack_short_name(stack_name)
    for e in events:
        if (e.get("ResourceType") == "AWS::CloudFormation::Stack" and
                e.get("LogicalResourceId") != short_name and
                e.get("PhysicalResourceId")):
            lid = e["LogicalResourceId"]
            if lid not in nested:
                nested[lid] = e["PhysicalResourceId"]
    return nested


def get_nested_stacks(cfn, stack_name):
    nested = {}
    try:
        for page in cfn.get_paginator("list_stack_resources").paginate(StackName=stack_name):
            for r in page["StackResourceSummaries"]:
                if r["ResourceType"] == "AWS::CloudFormation::Stack":
                    nested[r["LogicalResourceId"]] = r.get("PhysicalResourceId", "")
        return nested
    except ClientError:
        return None


def format_duration(seconds):
    if seconds < 0:
        return "0s"
    seconds = math.ceil(seconds)
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}m {secs}s"
    else:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        return f"{hours}h {minutes}m"


def is_cancelled_failure(reason):
    if not reason:
        return True
    cancelled_phrases = [
        "resource creation cancelled",
        "resource update cancelled",
        "resource modification cancelled",
    ]
    return reason.strip().lower() in cancelled_phrases


def identify_latest_operation(events, stack_name):
    short_name = get_stack_short_name(stack_name)
    by_time = sorted(events, key=lambda e: e["Timestamp"], reverse=True)

    terminal_statuses = [
        "CREATE_COMPLETE", "CREATE_FAILED",
        "UPDATE_COMPLETE", "UPDATE_ROLLBACK_COMPLETE", "UPDATE_ROLLBACK_FAILED", "UPDATE_FAILED",
        "DELETE_COMPLETE", "DELETE_FAILED",
        "ROLLBACK_COMPLETE", "ROLLBACK_FAILED",
    ]

    start_statuses = [
        "CREATE_IN_PROGRESS",
        "UPDATE_IN_PROGRESS",
        "DELETE_IN_PROGRESS",
    ]

    end_evt = None
    for e in by_time:
        if (e.get("ResourceType") == "AWS::CloudFormation::Stack" and
                e.get("LogicalResourceId") == short_name):
            status = e.get("ResourceStatus", "")
            if status in terminal_statuses:
                end_evt = e
                break

    if not end_evt:
        return None

    end_ts = end_evt["Timestamp"]

    start_evt = None
    for e in by_time:
        if (e.get("ResourceType") == "AWS::CloudFormation::Stack" and
                e.get("LogicalResourceId") == short_name and
                e["Timestamp"] < end_ts):
            status = e.get("ResourceStatus", "")
            if status in start_statuses:
                start_evt = e
                break

    if not start_evt:
        return None

    return {
        "start_time": start_evt["Timestamp"],
        "end_time": end_ts,
        "operation_type": start_evt["ResourceStatus"],
        "final_status": end_evt["ResourceStatus"],
    }


def extract_resource_timings(events, stack_name, root_op_start, root_op_end, depth, stack_path):
    short_name = get_stack_short_name(stack_name)

    window_events = [
        e for e in events
        if root_op_start <= e["Timestamp"] <= root_op_end
    ]

    resource_events = defaultdict(list)
    for e in window_events:
        lid = e.get("LogicalResourceId", "")
        resource_type = e.get("ResourceType", "")

        if resource_type == "AWS::CloudFormation::Stack" and lid == short_name:
            continue

        resource_events[lid].append(e)

    timings = []

    for lid, res_events in resource_events.items():
        res_events.sort(key=lambda e: e["Timestamp"])

        resource_type = res_events[0].get("ResourceType", "Unknown")
        physical_id = ""

        forward_start = None
        forward_end = None
        forward_status = None
        forward_reason = None
        is_failed = False

        for event in res_events:
            status = event.get("ResourceStatus", "")
            timestamp = event["Timestamp"]

            if status in ("CREATE_IN_PROGRESS", "UPDATE_IN_PROGRESS", "DELETE_IN_PROGRESS"):
                if forward_start is None:
                    forward_start = timestamp
                    physical_id = event.get("PhysicalResourceId", "")

            if status in ("CREATE_COMPLETE", "UPDATE_COMPLETE", "DELETE_COMPLETE"):
                forward_end = timestamp
                forward_status = status
                physical_id = event.get("PhysicalResourceId", physical_id)
                if event.get("ResourceStatusReason"):
                    forward_reason = event["ResourceStatusReason"]
                break

            if status in ("CREATE_FAILED", "UPDATE_FAILED", "DELETE_FAILED"):
                forward_end = timestamp
                forward_status = status
                physical_id = event.get("PhysicalResourceId", physical_id)
                forward_reason = event.get("ResourceStatusReason", "")
                is_failed = True
                break

        if not forward_start:
            continue

        if forward_end:
            duration = (forward_end - forward_start).total_seconds()
        else:
            duration = (root_op_end - forward_start).total_seconds()
            forward_status = forward_status or "IN_PROGRESS"

        timings.append({
            "logical_id": lid,
            "resource_type": resource_type,
            "physical_id": physical_id,
            "start_time": forward_start,
            "end_time": forward_end,
            "duration_seconds": duration,
            "duration_minutes": round(duration / 60, 2),
            "final_status": forward_status,
            "status_reason": forward_reason,
            "is_failed": is_failed,
            "is_nested_stack": resource_type == "AWS::CloudFormation::Stack",
            "depth": depth,
            "stack_path": stack_path,
        })

    return timings


def walk_and_analyze(cfn, stack_name, root_op_start, root_op_end, depth=0, stack_path=None):
    short_name = get_stack_short_name(stack_name)
    if stack_path is None:
        stack_path = short_name

    all_timings = []
    stack_summary = []

    events = get_all_events(cfn, stack_name)
    if not events:
        return all_timings, stack_summary

    timings = extract_resource_timings(
        events, stack_name,
        root_op_start, root_op_end,
        depth, stack_path
    )

    real_failed = [t for t in timings if t["is_failed"] and not is_cancelled_failure(t["status_reason"])]
    total_count = len(timings)

    stack_summary.append({
        "stack": short_name,
        "stack_path": stack_path,
        "depth": depth,
        "total_resources": total_count,
        "failed": len(real_failed),
    })

    all_timings.extend(timings)

    # Get nested stacks
    nested = get_nested_stacks(cfn, stack_name)
    if nested is None:
        nested = get_nested_stacks_from_events(events, stack_name)

    for n_lid, n_arn in nested.items():
        if not n_arn:
            continue
        nested_path = f"{stack_path}/{n_lid}"
        child_timings, child_summary = walk_and_analyze(
            cfn, n_arn, root_op_start, root_op_end,
            depth=depth + 1, stack_path=nested_path
        )
        all_timings.extend(child_timings)
        stack_summary.extend(child_summary)

    return all_timings, stack_summary
