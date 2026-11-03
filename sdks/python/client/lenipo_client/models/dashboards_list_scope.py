from enum import StrEnum

class DashboardsListScope(StrEnum):
    FAVOURITES = "favourites"
    HOME = "home"
    MINE = "mine"
    SHARED = "shared"
    VISIBLE = "visible"

    def __str__(self) -> str:
        return str(self.value)
