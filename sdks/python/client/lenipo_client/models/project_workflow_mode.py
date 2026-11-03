from enum import StrEnum

class ProjectWorkflowMode(StrEnum):
    DEFINED = "defined"
    FREE = "free"

    def __str__(self) -> str:
        return str(self.value)
