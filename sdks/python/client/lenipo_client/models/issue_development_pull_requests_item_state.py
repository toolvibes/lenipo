from enum import StrEnum

class IssueDevelopmentPullRequestsItemState(StrEnum):
    CLOSED = "closed"
    DRAFT = "draft"
    MERGED = "merged"
    OPEN = "open"

    def __str__(self) -> str:
        return str(self.value)
