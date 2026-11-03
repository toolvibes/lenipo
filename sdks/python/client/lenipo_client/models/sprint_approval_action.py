from enum import StrEnum

class SprintApprovalAction(StrEnum):
    COMPLETE = "complete"
    START = "start"

    def __str__(self) -> str:
        return str(self.value)
