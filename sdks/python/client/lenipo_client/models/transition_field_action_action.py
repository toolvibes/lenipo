from enum import StrEnum

class TransitionFieldActionAction(StrEnum):
    ADD = "add"
    CLEAR = "clear"
    REMOVE = "remove"
    SET = "set"

    def __str__(self) -> str:
        return str(self.value)
