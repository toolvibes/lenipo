from enum import StrEnum

class PagesUnwatchScope(StrEnum):
    PAGE = "page"
    SUBTREE = "subtree"

    def __str__(self) -> str:
        return str(self.value)
