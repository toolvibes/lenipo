from enum import StrEnum

class SearchMatchIn(StrEnum):
    ATTACHMENT = "attachment"
    COMMENT = "comment"

    def __str__(self) -> str:
        return str(self.value)
