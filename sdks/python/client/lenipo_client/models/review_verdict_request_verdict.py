from enum import StrEnum

class ReviewVerdictRequestVerdict(StrEnum):
    APPROVED = "approved"
    CHANGES_REQUESTED = "changes_requested"

    def __str__(self) -> str:
        return str(self.value)
