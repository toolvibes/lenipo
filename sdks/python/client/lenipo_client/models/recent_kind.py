from enum import StrEnum

class RecentKind(StrEnum):
    BOARD = "board"
    ISSUE = "issue"
    PAGE = "page"
    PROJECT = "project"
    SPACE = "space"

    def __str__(self) -> str:
        return str(self.value)
