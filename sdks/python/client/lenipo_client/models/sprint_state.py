from enum import StrEnum

class SprintState(StrEnum):
    ACTIVE = "active"
    CLOSED = "closed"
    FUTURE = "future"

    def __str__(self) -> str:
        return str(self.value)
