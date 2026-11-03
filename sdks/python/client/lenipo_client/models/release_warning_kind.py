from enum import StrEnum

class ReleaseWarningKind(StrEnum):
    BLOCKED = "blocked"
    OVERDUE = "overdue"
    UNASSIGNED = "unassigned"

    def __str__(self) -> str:
        return str(self.value)
