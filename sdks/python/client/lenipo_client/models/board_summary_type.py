from enum import StrEnum

class BoardSummaryType(StrEnum):
    KANBAN = "kanban"
    SCRUM = "scrum"

    def __str__(self) -> str:
        return str(self.value)
