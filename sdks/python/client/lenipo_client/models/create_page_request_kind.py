from enum import StrEnum

class CreatePageRequestKind(StrEnum):
    BLOG = "blog"
    PAGE = "page"

    def __str__(self) -> str:
        return str(self.value)
