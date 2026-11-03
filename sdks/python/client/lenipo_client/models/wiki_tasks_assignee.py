from enum import StrEnum

class WikiTasksAssignee(StrEnum):
    ALL = "all"
    ME = "me"

    def __str__(self) -> str:
        return str(self.value)
