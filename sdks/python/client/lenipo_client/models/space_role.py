from enum import StrEnum

class SpaceRole(StrEnum):
    ADMINISTRATORS = "administrators"
    APPROVERS = "approvers"
    COMMENTERS = "commenters"
    EDITORS = "editors"
    VIEWERS = "viewers"

    def __str__(self) -> str:
        return str(self.value)
