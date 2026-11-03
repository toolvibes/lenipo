from enum import StrEnum

class CreateIssueLinkRequestDirection(StrEnum):
    INWARD = "inward"
    OUTWARD = "outward"

    def __str__(self) -> str:
        return str(self.value)
