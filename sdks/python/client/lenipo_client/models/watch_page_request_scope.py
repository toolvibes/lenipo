from enum import StrEnum

class WatchPageRequestScope(StrEnum):
    PAGE = "page"
    SUBTREE = "subtree"

    def __str__(self) -> str:
        return str(self.value)
