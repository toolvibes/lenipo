from enum import StrEnum

class DiffBlockType0Op(StrEnum):
    ADDED = "added"
    REMOVED = "removed"
    SAME = "same"

    def __str__(self) -> str:
        return str(self.value)
