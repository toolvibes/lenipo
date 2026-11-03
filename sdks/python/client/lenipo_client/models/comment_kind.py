from enum import StrEnum

class CommentKind(StrEnum):
    COMMENT = "comment"
    HANDOVER = "handover"
    REVIEW = "review"

    def __str__(self) -> str:
        return str(self.value)
