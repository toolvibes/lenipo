from enum import StrEnum

class BackupTrigger(StrEnum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"

    def __str__(self) -> str:
        return str(self.value)
