from enum import StrEnum

class ActivityEntryKind(StrEnum):
    COMMENTED = "commented"
    CREATED = "created"
    UPDATED = "updated"

    def __str__(self) -> str:
        return str(self.value)
