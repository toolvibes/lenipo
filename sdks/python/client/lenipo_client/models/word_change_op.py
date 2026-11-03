from enum import StrEnum

class WordChangeOp(StrEnum):
    ADDED = "added"
    REMOVED = "removed"
    SAME = "same"

    def __str__(self) -> str:
        return str(self.value)
