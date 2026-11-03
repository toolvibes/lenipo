from enum import StrEnum

class CommentKind(StrEnum):
    COMMENT = "comment"
    HANDOVER = "handover"

    def __str__(self) -> str:
        return str(self.value)
