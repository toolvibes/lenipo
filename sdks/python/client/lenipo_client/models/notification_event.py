from enum import StrEnum

class NotificationEvent(StrEnum):
    ASSIGNED = "assigned"
    COMMENTED = "commented"
    CREATED = "created"
    STATUS = "status"
    UPDATED = "updated"

    def __str__(self) -> str:
        return str(self.value)
