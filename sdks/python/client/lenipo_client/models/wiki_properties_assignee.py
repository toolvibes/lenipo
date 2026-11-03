from enum import StrEnum

class WikiPropertiesAssignee(StrEnum):
    ALL = "all"
    ME = "me"

    def __str__(self) -> str:
        return str(self.value)
