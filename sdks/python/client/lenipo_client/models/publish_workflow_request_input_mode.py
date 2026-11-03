from enum import StrEnum

class PublishWorkflowRequestInputMode(StrEnum):
    DEFINED = "defined"
    FREE = "free"

    def __str__(self) -> str:
        return str(self.value)
