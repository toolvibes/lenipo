from enum import StrEnum

class FavouriteKind(StrEnum):
    BOARD = "board"
    DASHBOARD = "dashboard"
    FILTER = "filter"
    PAGE = "page"
    PROJECT = "project"
    SPACE = "space"

    def __str__(self) -> str:
        return str(self.value)
