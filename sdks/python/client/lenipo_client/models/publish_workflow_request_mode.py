from enum import StrEnum

class PublishWorkflowRequestMode(StrEnum):
    DEFINED = "defined"
    FREE = "free"

    def __str__(self) -> str:
        return str(self.value)
