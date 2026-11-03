from enum import StrEnum

class IssueDevelopmentPullRequestsItemReviewType0(StrEnum):
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"

    def __str__(self) -> str:
        return str(self.value)
