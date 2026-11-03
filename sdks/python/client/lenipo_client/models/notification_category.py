from enum import StrEnum

class NotificationCategory(StrEnum):
    ASSIGNED = "assigned"
    COMMENT = "comment"
    MENTION = "mention"
    OTHER = "other"
    STATUS = "status"

    def __str__(self) -> str:
        return str(self.value)
