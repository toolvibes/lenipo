from enum import StrEnum

class TransitionRulesInputComment(StrEnum):
    NONE = "none"
    OPTIONAL = "optional"
    REQUIRED = "required"

    def __str__(self) -> str:
        return str(self.value)
