from enum import StrEnum

class AgentActivityKind(StrEnum):
    APPROVAL = "approval"
    CHANGE = "change"
    COMMENT = "comment"
    REQUEST = "request"
    REVIEW = "review"

    def __str__(self) -> str:
        return str(self.value)
