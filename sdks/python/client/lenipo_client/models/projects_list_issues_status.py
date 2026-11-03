from enum import StrEnum

class ProjectsListIssuesStatus(StrEnum):
    DONE = "done"
    IN_PROGRESS = "in_progress"
    TODO = "todo"
    UNRESOLVED = "unresolved"

    def __str__(self) -> str:
        return str(self.value)
