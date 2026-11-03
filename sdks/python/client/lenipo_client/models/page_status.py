from enum import StrEnum

class PageStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in-review"
    NONE = "none"
    OUTDATED = "outdated"
    VERIFIED = "verified"

    def __str__(self) -> str:
        return str(self.value)
