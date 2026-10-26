"""Storage of the learners' accounts and progress.

DynamoDB table, partition key `username`, sort key `record`:
  - record "profile": passwordHash, createdAt, lastSeenAt, failed logins and lock, and for
    every deck `<deck>Known` and `<deck>Unremembered` (n5Known, n3Unremembered…) so the level
    of each learner can be read in the DynamoDB console;
  - record "session#<SHA-256 of the token>": a login session, deleted by DynamoDB after
    `expiresAt` (TTL);
  - record "n5", "n4", "n3", "n2": the progress of that deck (`words` and `cards` as JSON),
    its counts (known, unremembered, flashcards), updatedAt and a `version` that makes
    concurrent saves of the same deck retry instead of overwriting each other.
"""

import copy
import json

from progress import DECKS, empty_progress

PROFILE = "profile"
SESSION_PREFIX = "session#"


class VersionConflict(Exception):
    """The deck was saved by another request since it was read."""


def _profile_counts(summaries: dict) -> dict:
    """{"n3": {"known": 4, …}} → {"n3Known": 4, "n3Unremembered": …}."""
    return {
        f"{deck}{field[0].upper()}{field[1:]}": summary[field]
        for deck, summary in summaries.items()
        for field in ("known", "unremembered")
    }


class ProgressTable:
    """Accounts and progress kept in a DynamoDB table (boto3 Table resource)."""

    def __init__(self, table) -> None:
        self.table = table
        self._conditional_failure = table.meta.client.exceptions.ConditionalCheckFailedException

    # Accounts

    def get_profile(self, username: str) -> dict | None:
        return self._get(username, PROFILE)

    def create_profile(self, username: str, password_hash: str, now: str) -> bool:
        """False when the username is taken."""
        try:
            self.table.put_item(
                Item={"username": username, "record": PROFILE, "passwordHash": password_hash, "createdAt": now, "lastSeenAt": now},
                ConditionExpression="attribute_not_exists(#username)",
                ExpressionAttributeNames={"#username": "username"},
            )
        except self._conditional_failure:
            return False
        return True

    def set_password(self, username: str, password_hash: str) -> bool:
        """Replaces the password and closes every session; False when there is no such account."""
        try:
            self.table.update_item(
                Key={"username": username, "record": PROFILE},
                UpdateExpression="SET passwordHash = :hash REMOVE failedLogins, lockedUntil",
                ConditionExpression="attribute_exists(#username)",
                ExpressionAttributeNames={"#username": "username"},
                ExpressionAttributeValues={":hash": password_hash},
            )
        except self._conditional_failure:
            return False
        for item in self._query(username, SESSION_PREFIX):
            self.table.delete_item(Key={"username": username, "record": item["record"]})
        return True

    def add_login_failure(self, username: str) -> int:
        """Counts a wrong password; returns the failures since the last successful login."""
        attributes = self.table.update_item(
            Key={"username": username, "record": PROFILE},
            UpdateExpression="ADD failedLogins :one",
            ExpressionAttributeValues={":one": 1},
            ReturnValues="UPDATED_NEW",
        )["Attributes"]
        return int(attributes["failedLogins"])

    def lock(self, username: str, until: int) -> None:
        self.table.update_item(
            Key={"username": username, "record": PROFILE},
            UpdateExpression="SET lockedUntil = :until REMOVE failedLogins",
            ExpressionAttributeValues={":until": until},
        )

    def clear_login_failures(self, username: str) -> None:
        self.table.update_item(Key={"username": username, "record": PROFILE}, UpdateExpression="REMOVE failedLogins, lockedUntil")

    def touch_profile(self, username: str, now: str, summaries: dict | None = None) -> None:
        """Records the last visit and the counts of `summaries`."""
        values = {"lastSeenAt": now, **_profile_counts(summaries or {})}
        try:
            self.table.update_item(
                Key={"username": username, "record": PROFILE},
                UpdateExpression="SET " + ", ".join(f"#{name} = :{name}" for name in values),
                # Never creates a profile without password.
                ConditionExpression="attribute_exists(#username)",
                ExpressionAttributeNames={"#username": "username", **{f"#{name}": name for name in values}},
                ExpressionAttributeValues={f":{name}": value for name, value in values.items()},
            )
        except self._conditional_failure:
            pass

    # Sessions

    def create_session(self, username: str, token_hash: str, now: str, expires_at: int) -> None:
        self.table.put_item(
            Item={"username": username, "record": SESSION_PREFIX + token_hash, "createdAt": now, "expiresAt": expires_at}
        )

    def get_session(self, username: str, token_hash: str) -> dict | None:
        return self._get(username, SESSION_PREFIX + token_hash)

    def delete_session(self, username: str, token_hash: str) -> None:
        self.table.delete_item(Key={"username": username, "record": SESSION_PREFIX + token_hash})

    # Progress

    def load_decks(self, username: str) -> dict[str, tuple[dict, int]]:
        """Every saved deck as (progress, version)."""
        return {item["record"]: self._deck(item) for item in self._query(username, "n") if item["record"] in DECKS}

    def load_deck(self, username: str, deck: str) -> tuple[dict, int]:
        item = self._get(username, deck)
        return self._deck(item) if item else (empty_progress(), 0)

    def save_deck(self, username: str, deck: str, progress: dict, summary: dict, version: int, now: str) -> None:
        """Writes the deck unless another request saved it since `version` was read."""
        try:
            self.table.put_item(
                Item={
                    "username": username,
                    "record": deck,
                    "words": json.dumps(progress["words"], separators=(",", ":")),
                    "cards": json.dumps(progress["cards"], separators=(",", ":")),
                    **summary,
                    "updatedAt": now,
                    "version": version + 1,
                },
                ConditionExpression="attribute_not_exists(#version) OR #version = :version",
                ExpressionAttributeNames={"#version": "version"},
                ExpressionAttributeValues={":version": version},
            )
        except self._conditional_failure as error:
            raise VersionConflict(deck) from error

    def _get(self, username: str, record: str) -> dict | None:
        return self.table.get_item(Key={"username": username, "record": record}, ConsistentRead=True).get("Item")

    def _query(self, username: str, record_prefix: str) -> list[dict]:
        items, kwargs = [], {
            "KeyConditionExpression": "#username = :username AND begins_with(#record, :prefix)",
            "ExpressionAttributeNames": {"#username": "username", "#record": "record"},
            "ExpressionAttributeValues": {":username": username, ":prefix": record_prefix},
            "ConsistentRead": True,
        }
        while True:
            page = self.table.query(**kwargs)
            items += page["Items"]
            if "LastEvaluatedKey" not in page:
                return items
            kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    @staticmethod
    def _deck(item: dict) -> tuple[dict, int]:
        progress = {section: json.loads(item.get(section) or "{}") for section in ("words", "cards")}
        return progress, int(item.get("version", 0))


class MemoryProgressTable:
    """Same interface kept in memory, for the tests and backend/dev_server.py."""

    def __init__(self) -> None:
        self.items: dict[tuple[str, str], dict] = {}

    def get_profile(self, username: str) -> dict | None:
        return copy.deepcopy(self.items.get((username, PROFILE)))

    def create_profile(self, username: str, password_hash: str, now: str) -> bool:
        if (username, PROFILE) in self.items:
            return False
        self.items[(username, PROFILE)] = {"passwordHash": password_hash, "createdAt": now, "lastSeenAt": now}
        return True

    def set_password(self, username: str, password_hash: str) -> bool:
        profile = self.items.get((username, PROFILE))
        if profile is None:
            return False
        profile["passwordHash"] = password_hash
        profile.pop("failedLogins", None)
        profile.pop("lockedUntil", None)
        for key in [key for key in self.items if key[0] == username and key[1].startswith(SESSION_PREFIX)]:
            del self.items[key]
        return True

    def add_login_failure(self, username: str) -> int:
        profile = self.items[(username, PROFILE)]
        profile["failedLogins"] = profile.get("failedLogins", 0) + 1
        return profile["failedLogins"]

    def lock(self, username: str, until: int) -> None:
        profile = self.items[(username, PROFILE)]
        profile["lockedUntil"] = until
        profile.pop("failedLogins", None)

    def clear_login_failures(self, username: str) -> None:
        profile = self.items[(username, PROFILE)]
        profile.pop("failedLogins", None)
        profile.pop("lockedUntil", None)

    def touch_profile(self, username: str, now: str, summaries: dict | None = None) -> None:
        if (username, PROFILE) in self.items:
            self.items[(username, PROFILE)].update(lastSeenAt=now, **_profile_counts(summaries or {}))

    def create_session(self, username: str, token_hash: str, now: str, expires_at: int) -> None:
        self.items[(username, SESSION_PREFIX + token_hash)] = {"createdAt": now, "expiresAt": expires_at}

    def get_session(self, username: str, token_hash: str) -> dict | None:
        return copy.deepcopy(self.items.get((username, SESSION_PREFIX + token_hash)))

    def delete_session(self, username: str, token_hash: str) -> None:
        self.items.pop((username, SESSION_PREFIX + token_hash), None)

    def load_decks(self, username: str) -> dict[str, tuple[dict, int]]:
        return {deck: self.load_deck(username, deck) for deck in DECKS if (username, deck) in self.items}

    def load_deck(self, username: str, deck: str) -> tuple[dict, int]:
        item = self.items.get((username, deck))
        return (copy.deepcopy(item["progress"]), item["version"]) if item else (empty_progress(), 0)

    def save_deck(self, username: str, deck: str, progress: dict, summary: dict, version: int, now: str) -> None:
        stored = self.items.get((username, deck))
        if (stored["version"] if stored else 0) != version:
            raise VersionConflict(deck)
        self.items[(username, deck)] = {
            "progress": copy.deepcopy(progress),
            **summary,
            "updatedAt": now,
            "version": version + 1,
        }
