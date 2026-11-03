from enum import StrEnum

class BurndownPointType(StrEnum):
    ADDED = "added"
    DONE = "done"
    ESTIMATE = "estimate"
    NOW = "now"
    REMOVED = "removed"
    REOPENED = "reopened"
    START = "start"

    def __str__(self) -> str:
        return str(self.value)
