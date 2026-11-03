from enum import StrEnum

class BoardType(StrEnum):
    KANBAN = "kanban"
    SCRUM = "scrum"

    def __str__(self) -> str:
        return str(self.value)
