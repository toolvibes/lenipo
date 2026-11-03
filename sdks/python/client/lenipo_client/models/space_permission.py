from enum import StrEnum

class SpacePermission(StrEnum):
    ADMINISTER = "administer"
    APPROVE = "approve"
    COMMENT = "comment"
    EDIT = "edit"
    VIEW = "view"

    def __str__(self) -> str:
        return str(self.value)
