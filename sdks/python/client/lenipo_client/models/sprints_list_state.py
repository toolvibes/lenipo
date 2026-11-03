from enum import StrEnum

class SprintsListState(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"
    FUTURE = "future"

    def __str__(self) -> str:
        return str(self.value)
