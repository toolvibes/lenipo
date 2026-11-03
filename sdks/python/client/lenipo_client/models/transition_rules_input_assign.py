from enum import StrEnum

class TransitionRulesInputAssign(StrEnum):
    CALLER = "caller"
    KEEP = "keep"
    NOBODY = "nobody"
    REPORTER = "reporter"

    def __str__(self) -> str:
        return str(self.value)
