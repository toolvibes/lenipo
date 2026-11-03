from enum import StrEnum

class NotificationDetailsKind(StrEnum):
    COMMENTED = "commented"
    CREATED = "created"
    PUBLISHED = "published"
    UPDATED = "updated"

    def __str__(self) -> str:
        return str(self.value)
