from enum import StrEnum

class CreateBoardRequestType(StrEnum):
    KANBAN = "kanban"
    SCRUM = "scrum"

    def __str__(self) -> str:
        return str(self.value)
