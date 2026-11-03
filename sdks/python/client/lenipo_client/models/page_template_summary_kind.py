from enum import StrEnum

class PageTemplateSummaryKind(StrEnum):
    BLUEPRINT = "blueprint"
    GLOBAL = "global"
    SPACE = "space"

    def __str__(self) -> str:
        return str(self.value)
