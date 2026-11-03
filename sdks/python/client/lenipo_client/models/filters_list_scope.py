from enum import StrEnum

class FiltersListScope(StrEnum):
    FAVOURITES = "favourites"
    MINE = "mine"
    SHARED = "shared"
    VISIBLE = "visible"

    def __str__(self) -> str:
        return str(self.value)
