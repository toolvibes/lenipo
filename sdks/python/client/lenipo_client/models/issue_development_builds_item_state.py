from enum import StrEnum

class IssueDevelopmentBuildsItemState(StrEnum):
    FAILURE = "failure"
    PENDING = "pending"
    SUCCESS = "success"

    def __str__(self) -> str:
        return str(self.value)
