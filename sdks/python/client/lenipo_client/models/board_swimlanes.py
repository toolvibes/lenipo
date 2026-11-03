from enum import StrEnum

class BoardSwimlanes(StrEnum):
    ASSIGNEE = "assignee"
    EPIC = "epic"
    NONE = "none"

    def __str__(self) -> str:
        return str(self.value)
