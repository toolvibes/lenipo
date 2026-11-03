from enum import StrEnum

class TransitionFieldActionInputAction(StrEnum):
    ADD = "add"
    CLEAR = "clear"
    REMOVE = "remove"
    SET = "set"

    def __str__(self) -> str:
        return str(self.value)
