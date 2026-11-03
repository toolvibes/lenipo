from enum import StrEnum

class IssuePageRefKind(StrEnum):
    MACRO = "macro"
    MENTION = "mention"

    def __str__(self) -> str:
        return str(self.value)
