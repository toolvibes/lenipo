from enum import StrEnum

class AutomationTriggerType10Event(StrEnum):
    BRANCH_CREATED = "branch_created"
    BUILD_FAILED = "build_failed"
    COMMIT_PUSHED = "commit_pushed"
    PULL_REQUEST_MERGED = "pull_request_merged"
    PULL_REQUEST_OPENED = "pull_request_opened"

    def __str__(self) -> str:
        return str(self.value)
