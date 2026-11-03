from enum import StrEnum

class ReviewStatus(StrEnum):
    APPROVED = "approved"
    CANCELLED = "cancelled"
    CHANGES_REQUESTED = "changes_requested"
    REQUESTED = "requested"

    def __str__(self) -> str:
        return str(self.value)
