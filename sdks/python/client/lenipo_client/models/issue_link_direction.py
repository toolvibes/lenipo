from enum import StrEnum

class IssueLinkDirection(StrEnum):
    INWARD = "inward"
    OUTWARD = "outward"

    def __str__(self) -> str:
        return str(self.value)
