from enum import StrEnum

class PageWatchStateInheritedType0(StrEnum):
    ANCESTOR = "ancestor"
    SPACE = "space"

    def __str__(self) -> str:
        return str(self.value)
