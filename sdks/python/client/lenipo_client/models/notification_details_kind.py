from enum import StrEnum

class NotificationDetailsKind(StrEnum):
    APPROVAL = "approval"
    BUDGET = "budget"
    COMMENTED = "commented"
    CREATED = "created"
    PUBLISHED = "published"
    REVIEW = "review"
    UPDATED = "updated"

    def __str__(self) -> str:
        return str(self.value)
