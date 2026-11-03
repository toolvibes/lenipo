from enum import StrEnum

class TransitionRulesComment(StrEnum):
    NONE = "none"
    OPTIONAL = "optional"
    REQUIRED = "required"

    def __str__(self) -> str:
        return str(self.value)
