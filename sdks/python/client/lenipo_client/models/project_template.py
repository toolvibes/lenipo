from enum import StrEnum

class ProjectTemplate(StrEnum):
    BASIC = "basic"
    BUGS = "bugs"
    KANBAN = "kanban"
    SCRUM = "scrum"

    def __str__(self) -> str:
        return str(self.value)
