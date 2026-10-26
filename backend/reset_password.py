"""Sets a new password for a learner who forgot theirs and closes their sessions.

Usage (from the repo root, with credentials of the AWS account, e.g. after `aws configure`):
    pip install boto3
    python3 backend/reset_password.py USERNAME

The table is found in the outputs of the TodoApiStack stack. The learner's progress is kept.
"""

import getpass
import sys

import boto3

from auth import check_password, hash_password
from progress import InvalidInput, normalize_username
from store import ProgressTable

STACK = "TodoApiStack"
REGION = "ap-southeast-1"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    try:
        username = normalize_username(sys.argv[1])
        password = check_password(getpass.getpass(f"Mật khẩu mới của {username}: "))
        if check_password(getpass.getpass("Nhập lại mật khẩu mới: ")) != password:
            raise SystemExit("Hai mật khẩu không khớp")
    except InvalidInput as error:
        raise SystemExit(str(error)) from error

    outputs = boto3.client("cloudformation", region_name=REGION).describe_stacks(StackName=STACK)["Stacks"][0]["Outputs"]
    table_name = next(output["OutputValue"] for output in outputs if output["OutputKey"] == "ProgressTableName")
    table = ProgressTable(boto3.resource("dynamodb", region_name=REGION).Table(table_name))
    if not table.set_password(username, hash_password(password)):
        raise SystemExit(f"Không có tài khoản {username}")
    print(f"Đã đặt mật khẩu mới cho {username}; các thiết bị đang đăng nhập phải đăng nhập lại.")


if __name__ == "__main__":
    main()
